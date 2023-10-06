const express = require('express')
const Sequelize = require('sequelize')
const db = require('./models/index')
const { rsvp } = require('./models')


const app = express()

app.set('view engine', 'ejs')
app.use(express.json())


app.get('/rsvp/:tank', (req, res)=>{
        
    let tank = req.query.tank
    if (['1','2','3'].includes(tank)){
        var fishtank = tank
        res.render('index', { fishtank:fishtank})
    }else{
        res.render('index', { fishtank:NaN})
    }
    
})


app.get('/api/get/fishtanks', (req, res)=>{
    const fishtanks = ['1','2','3','4']
    
    res.send(fishtanks)
})

app.get('/lol', (req, res)=>{

    res.redirect('https://www.youtube.com/watch?v=a3Z7zEc7AXQ')
})

app.get('/', (req, res)=>{

    res.status(402).redirect('/lol')
})

app.get('/api/get/fishtank/:id', async (req, res)=>{
    const fishtanks = ['1','2','3','4']
    
    const reservations = await rsvp.findAll({where:{ fishtank:req.params.id}})


    res.send(reservations)
})

app.post('/api/post/rsvp', async (req, res)=> {
    try {
        const reservation = await db.rsvp.create({ name: req.body.name, wallet:req.body.wallet, hash:req.body.hash, fishtank:req.body.fishtank, start:req.body.start, end:req.body.end})
    } catch (error) {
        
    }
    
    res.sendStatus(200)
})









db.sequelize.sync({ alter: true}).then(()=>{
    app.listen(3000, ()=>{
        console.log('http://localhost:3000')
    })
})

