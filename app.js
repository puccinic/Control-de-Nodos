'use strict'
const exprress = require('express')
const cors = require('cors')
let Data = require('./Data.js').data
const bodyParser = require('body-parser')
const ModbusRTU = require('modbus-serial')
const app = exprress()
const port = 4000
const client = new ModbusRTU()

client.connectRTUBuffered('COM1', { baudRate: 9600, parity: 'none', dataBits: 8, stopBits: 1 })
    .then(() => console.log('Conexión exitosa'))
    .catch(console.log)

app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.use(cors())

const readContacts = async (req, res) => {
    const { dir, contacts } = req.body
    client.setID(dir)
    let newContacts = []
    for (let contact of contacts) {
        try {
            let { data } = await client.readCoils(contact.In, 1)
            let newValue = { ...contact, value: data[0] }
            newContacts = [...newContacts, newValue]

        } catch (error) {
            console.log(error)
        }
    }
    res.json(newContacts)

}

app.route('/Datos')
    .get((req, res) => {
        res.json(Data)
    })
    .post((req, res) => {
        Data = req.body
        res.json('Cambios guardados satisfactoriamente')
    })

app.route('/ControlNodo')
    .get(readContacts)
    .post((req, res) => {

        const { dir, In, Out, value } = req.body
        client.setID(dir)
        client.writeCoil(Out, value)
            .then(() => client.readCoils(In, 1))
            .then(data => res.json(data))
            .catch(error => res.send(error))
    })

app.route('/Emergencia').post(async (req, res) => {
    const { dir, contacts } = req.body
    client.setID(dir)
    for (let contact of contacts) {
        try {
            await client.writeCoil(contact.Out, false)
        } catch (error) {
            console.log(error)
        }
    }
    readContacts(req,res)
})

app.listen(port, () => console.log(`Example app listening at port ${port}`))



