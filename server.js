const express = require('express')
const db = require('./models/index')
const { rsvp } = require('./models')
const QRCode= require('qrcode')
const main_url = "https://v57nr3jh-3000.uks1.devtunnels.ms"
const base58 = require('base-58')

// Solana pay imports
const { clusterApiUrl, Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js')
const BigNumber = require('bignumber.js')
const { createTransferCheckedInstruction, getAccount, getAssociatedTokenAddress, getMint, getOrCreateAssociatedTokenAccount } = require('@solana/spl-token')
const { TEN, encodeURL, createQR } = require('@solana/pay')
const { dirname } = require('path')



// Coneection
const cluster = 'mainnet-beta'
const endpoint = clusterApiUrl(cluster);
const connection = new Connection(endpoint, 'confirmed');


//Token
const splToken = new PublicKey('DwWQHDiyLauoh3pUih7X6G1TrqQnAjgpZ1W7ufrJQcb9');
//wallet
const MERCHANT_WALLET = new PublicKey('Annf2Hqk8xsfRQcGL3j4WRQXJhx4umM3uV4jv56qzWMK');

// 6NhgBfVm9imA1h6Kd8HabdbiRAXf77Xcxh189dHZHMwx

const app = express()

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




app.get('/api/get/fishtank/:id', async (req, res)=>{
    try {
        const reservations = await db.rsvp.findAndCountAll({where:{ fishtank:req.params.id, date:req.header("date")}, raw: true })
        let result = []
        let count = await reservations.count
        console.log(await reservations.count)
        await reservations.rows.forEach(async (rows, i) => {
            result.push({
                period: await reservations.rows[i].period,
                wallet: await reservations.rows[i].wallet,
            })
            console.log(result)
            
        })
    res.send(await result)

        
    } catch (error) {
        console.log(error)
    }


    
})


app.get('/files/qrcodes/:file', (req,res)=>{
    try {
        res.sendFile(__dirname +'/files/qrcodes/' + req.params.file) 
    } catch (error) {
     console.log(error)   
     res.sendStatus(400)
    }
})




app.post('/api/post/checkout/:id',  async (req, res)=>{
    let fishtank = req.query.tank
    let period = req.query.period
    let date = req.query.date
    let new_date = new Date(date)
    console.log(new_date)
    if(!fishtank || !period || !date || !new_date){ return res.sendStatus(400)}

    if(new_date.getUTCMilliseconds() <= new Date.now()){ return res.sendStatus(400)}

    res.sendStatus(200)
})


app.post('/api/post/rsvp', async (req, res)=> {

    try {
        const reservation = await db.rsvp.create({ name: req.body.name, wallet:req.body.wallet, hash:req.body.hash, fishtank:req.body.fishtank, date:req.body.date, period:req.body.period})
    } catch (error) {
        console.log(error)
    }
    
    res.sendStatus(200)
})


app.post('/api/post/checkout', async (req, res)=> {
    
    try {

        let check_period_checkout = await db.checkout.findOne({ where: { period: req.body.period, fishtank: req.body.fishtank, date:req.body.date}})
        let check_period_rsvp = await db.rsvp.findOne({ where: { period: req.body.period, fishtank: req.body.fishtank, date:req.body.date}})
        if(check_period_checkout || check_period_rsvp){ return res.sendStatus(400); }

        const checkout = await db.checkout.create({ fishtank:req.body.fishtank, date:req.body.date, period:req.body.period})

        let url = encodeURL({link:main_url + '?id=' + checkout.checkoutId})

       //let qr = createQR(url, 512, 'white', 'black').download(__dirname + '/files/qrcodes/' + checkout.checkoutId + '.svg')
        QRCode.toFile(__dirname +'/files/qrcodes/' + checkout.checkoutId + '.png', url.href, { errorCorrectionLevel: 'M' })


        res.send({ checkoutId:checkout.checkoutId, qr: main_url + '/files/qrcodes/' + checkout.checkoutId + '.png', url:url })
    } catch (error) {
        console.log(error)
        res.sendStatus(500)
    }
    
    
})



// Solana pay

app.get('/', (req, res)=>{
    const icon = main_url + '/label.svg'
    res.send({"label":"Fishtanks Reservations", "icon":icon})
})

app.get('/label.svg', (req, res)=>{
    res.sendFile(__dirname + '/files/icon.svg')
})



app.post('/', async (req,res)=>{
try {

    // We pass the reference to use in the query
    const reference  = req.query.id
    if (!reference) {
      res.status(400).send({ error: "No reference provided" })
      return console.log('No reference')
    }


    // We pass the selected items in the query, calculate the expected cost
    const amount = await calculatePrice(reference)
    if (!amount) {
      res.status(400).send({ error: "No checkout detected" })
      return console.log('No checkout reference')
    }



    // We pass the buyer's public key in JSON body
    const account  = req.body.account
    if (!account) {
      res.status(400).send({ error: "No account provided" })
      return console.log('No account provided')
    }
    const buyerPublicKey = new PublicKey(account)
    const shopPublicKey = MERCHANT_WALLET


    // Get details about the token
    const Mint = await getMint(connection, splToken)
    // Get the buyer's USDC token account address
    const buyerUsdcAddress = await getAssociatedTokenAddress(splToken, buyerPublicKey)
    // Get the shop's USDC token account address
    const shopUsdcAddress = await getAssociatedTokenAddress(splToken, shopPublicKey)

    // Get a recent blockhash to include in the transaction
    const lastblock = await connection.getLatestBlockhash('finalized')
    const transaction = new Transaction({
      blockhash: lastblock.blockhash,
      // The buyer pays the transaction fee
      feePayer: buyerPublicKey,
      lastValidBlockHeight: lastblock.lastValidBlockHeight
    })

    // Create the instruction to send USDC from the buyer to the shop
    const transferInstruction = createTransferCheckedInstruction(
      buyerUsdcAddress, // source
      splToken, // mint (token address)
      shopUsdcAddress, // destination
      buyerPublicKey, // owner of source address
      amount, // amount to transfer (in units of the USDC token)
      1, // decimals of the USDC token
    )

    // Add the reference to the instruction as a key
    // This will mean this transaction is returned when we query for the reference
    const pubkey = new Keypair().publicKey
    transferInstruction.keys.push({
      pubkey: pubkey,
      isSigner: false,
      isWritable: false,
    })

    // Add the instruction to the transaction
    transaction.add(transferInstruction)

    // Serialize the transaction and convert to base64 to return it
    const serializedTransaction =  transaction.serialize({
      // We will need the buyer to sign this transaction after it's returned to them
      requireAllSignatures: false
    })
    const base64 = serializedTransaction.toString('base64')

    // Insert into database: reference, amount

    // Return the serialized transaction
    res.send({
      transaction: base64,
      message: "Thanks for your order! 🍪",
    })
  } catch (err) {
    console.log(err);

    res.status(500).send({ error: 'error creating transaction', })
    return
  }
});



async function calculatePrice(id) {
    let checkout = await db.checkout.findOne({where:{checkoutId:id}})
    
    let amount = 5
    if (!await checkout){amount = null}
    
    
    return amount;
}
// TODO: Checkout calculatibng and calculateCheckoutAmount(), reservation handeling
// maybe periods instaed of times?







//  alter: true
db.sequelize.sync({force: true}).then(()=>{
    app.listen(3000, ()=>{
        console.log(main_url)
    })
})

