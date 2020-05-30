'use strict'
const exprress = require('express')
const cors = require('cors')
const fs = require('fs');
const bodyParser = require('body-parser')
const ModbusRTU = require('modbus-serial')
let Data = require('./Data.json')
const app = exprress()
const port = 4000

const client = new ModbusRTU()

const SERIAL_PORT = process.argv[2]

const READ_VALIDATION = (address, length) =>  {
    if (process.argv[3] === 'SIM') return client.readCoils(address, length)  
    else  return client.readDiscreteInputs(address, length)
}

client.connectRTUBuffered(SERIAL_PORT, { baudRate: 9600, parity: 'none', dataBits: 8, stopBits: 1 })
    .then(() => console.log('Conexión exitosa'))
    .then(() => client.setTimeout(1000))
    .catch(console.log)

app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.use(cors())

const readContacts = async (req, res) => {
    const { id } = req.query || req.body
    const { dir, contacts } = Data.find(e => e.id == id)
    if (!dir) {
        res.json({ message: 'El nodo no tiene una dirección asignada.' })
        return
    }

    if (!contacts.length) {
        res.json({ message: 'El nodo no tiene contactores asociados.' })
        return
    }


    client.setID(dir)
    let newContacts = []

    for (let contact of contacts) {
        try {
            let { data } = await READ_VALIDATION(contact.In, 1)
            let newValue = { ...contact, value: data[0] }
            newContacts = [...newContacts, newValue]

        } catch (error) {
            if (error.message === 'Timed out') error.message = 'No se pudo establecer conexión con el tablero.'
            if (error.message === 'Port Not Open') error.message = 'El Ordenador no está conectada al bus.'
            res.json(error)
            return
        }
    }
    res.json({
        id: id,
        dir: dir,
        contacts: newContacts
    })

}

app.route('/Datos')
    .get((req, res) => {
        res.json(Data)
    })
    .post((req, res) => {
        Data = req.body
        fs.writeFile('./Data.json', JSON.stringify(Data), err => {
            if (err) {
                console.log('Error writing file', err)
                res.json('Hubo un error al intentar guardar los cambios.')
            } else {
                res.json('Cambios guardados satisfactoriamente.')
            }
        });
    })

app.route('/ControlNodo')
    .get(readContacts)
    .post((req, res) => {

        const { dir, In, Out, value } = req.body
        client.setID(dir)
        client.writeCoil(Out, value)
            .then(() => READ_VALIDATION(In, 1))
            .then(obj => {
                if (obj.data[0] === value) res.json({ value: obj.data[0], message: 'funciona' })
                else res.json({ value: obj.data[0], message: 'Hubo un error accionando el contactor.' })
            })
            .catch(error => res.send(error))
    })

app.route('/Emergencia').post(async (req, res) => {
    const { id } = req.body
    const { dir, contacts } = Data.find(e => e.id == id)
    client.setID(dir)
    let stuckedContacts = []

    for (let contact of contacts) {
        try {
            await client.writeCoil(contact.Out, false)
            let obj = await READ_VALIDATION(contact.In, 1)
            if (!obj.data[0]) stuckedContacts.push(contact)

        } catch (error) {
            console.log(error)
        }
    }

    if (stuckedContacts.length) res.json('done')
    else res.json(stuckedContacts)
})

app.listen(port, () => console.log(`Aplicación escuchando el puerto ${port}`))



