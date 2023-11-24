const express = require('express')
const db = require('./models/index')
const QRCode= require('qrcode')
const config = require('./config.json')
const main_url = config.url
const fs = require('fs/promises')
const https = require('https')


const options ={
    key: await fs.readFile('./config/key.key'), 
    cert: await fs.readFile('./config/cert.crt')
}


// Solana pay imports
const { clusterApiUrl, Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js')
const BigNumber = require('bignumber.js')
const { createTransferCheckedInstruction, getAccount, getAssociatedTokenAddress, getMint, getOrCreateAssociatedTokenAccount, amountToUiAmount } = require('@solana/spl-token')
const { TEN, encodeURL, findReference, validateTransfer, FindReferenceError, ValidateTransferError } = require('@solana/pay')



// Coneection
const cluster = 'mainnet-beta'
const endpoint = clusterApiUrl(cluster);
const connection = new Connection(endpoint, 'confirmed');


//Token
const splToken = new PublicKey('DwWQHDiyLauoh3pUih7X6G1TrqQnAjgpZ1W7ufrJQcb9');
//wallet
const MERCHANT_KEYPAIR = Keypair.fromSecretKey(new Uint8Array(JSON.parse(config.pkey)))
//const MERCHANT_WALLET = new PublicKey(MERCHANT_KEYPAIR.publicKey)
const MERCHANT_WALLET = new PublicKey("FFzWfCaNva5R3FcmtADtxmbMA97rVhgM2GWhmzo2k5RB")



// Annf2Hqk8xsfRQcGL3j4WRQXJhx4umM3uV4jv56qzWMK
// 6NhgBfVm9imA1h6Kd8HabdbiRAXf77Xcxh189dHZHMwx

const app = express()

app.use(express.json())


app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });




const server = https.createServer(await options, app)



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
        let parts = req.header("date").split("/");
        let date = formatDate(new Date(parseInt(parts[2], 10),
                  parseInt(parts[1], 10) - 1,
                  parseInt(parts[0], 10)))
                  
        console.log(date)
        const reservations = await db.rsvp.findAndCountAll({where:{ fishtank:req.params.id, date:date}, raw: true })
        const checkouts = await db.checkout.findAndCountAll({where:{ fishtank:req.params.id, date:date}, raw: true })
        let result = []
        await reservations.rows.forEach(async (rows, i) => {
            result.push({
                period: await reservations.rows[i].period,
                wallet: await reservations.rows[i].wallet,
            })  
        })
        await checkouts.rows.forEach(async (rows ,i) => {
            result.push({
                period: await checkouts.rows[i].period,
                wallet: await checkouts.rows[i].wallet,
            })
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
     res.send({error:"No reference found"})
    }
})



// TESTING
app.post('/api/post/rsvp', async (req, res)=> {

    try {
        await db.rsvp.create({ name: req.body.name, wallet:req.body.wallet, hash:req.body.hash, fishtank:req.body.fishtank, date:req.body.date, period:req.body.period})
    } catch (error) {
        console.log(error)
    }
    
    res.sendStatus(200)
})

// ^^^ TESTING


app.post('/api/post/checkout', async (req, res)=> {
    
    try {
        let parts = req.body.date.split("/");
        let date = formatDate(new Date(parseInt(parts[2], 10),
                  parseInt(parts[1], 10) - 1,
                  parseInt(parts[0], 10)))


        const fechaProporcionada = new Date(date); fechaProporcionada.setHours(0, 0, 0, 0);  
        const fechaActual = new Date(); fechaActual.setHours(0, 0, 0, 0);  
        if (fechaProporcionada.getTime() < fechaActual.getTime()) {     
        return res.sendStatus(400); 
        } 



        let check_period_checkout = await db.checkout.findOne({ where: { period: req.body.period, fishtank: req.body.fishtank, date:date}})
        let check_period_rsvp = await db.rsvp.findOne({ where: { period: req.body.period, fishtank: req.body.fishtank, date:date}})
        if(check_period_checkout || check_period_rsvp){ return res.sendStatus(400); }

        const checkout = await db.checkout.create({ fishtank:req.body.fishtank, date:date, period:req.body.period, status:'started'})

        let url = encodeURL({link:main_url + '?id=' + checkout.checkoutId})

       //let qr = createQR(url, 512, 'white', 'black').download(__dirname + '/files/qrcodes/' + checkout.checkoutId + '.svg')
        QRCode.toFile(__dirname +'/files/qrcodes/' + checkout.checkoutId + '.png', url.href, { errorCorrectionLevel: 'M' })


        res.send({ checkoutId:checkout.checkoutId, qr: main_url + '/files/qrcodes/' + checkout.checkoutId + '.png', url:'solana:' + main_url + '?id=' + checkout.checkoutId, url2:url })
    } catch (error) {
        console.log(error)
        res.sendStatus(500)
    }
    
    
})



// Solana pay

app.get('/', (req, res)=>{
    const icon = main_url + '/logo.png'
    res.send({"label":"Fishtanks Reservations", "icon":icon})
})

app.get('/logo.png', (req, res)=>{
    res.sendFile(__dirname + '/files/logo.png')
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
    const shopAddress = await getAssociatedTokenAddress(splToken, shopPublicKey)
    const feepayerAccount = await getAssociatedTokenAddress(Mint.address, MERCHANT_KEYPAIR.publicKey)

    // Get a recent blockhash to include in the transaction
    const lastblock = await connection.getLatestBlockhash('finalized')
    const transaction = new Transaction({
      blockhash: lastblock.blockhash,
      // The buyer pays the transaction fee
      //feePayer: shopAddress,
      lastValidBlockHeight: lastblock.lastValidBlockHeight
    })

    // Create the instruction to send USDC from the buyer to the shop
    const transferInstruction = createTransferCheckedInstruction(
      buyerUsdcAddress, // source
      splToken, // mint (token address)
      shopAddress, // destination
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

    
    transaction.sign(MERCHANT_KEYPAIR)

    // Serialize the transaction and convert to base64 to return it
    const serializedTransaction =  transaction.serialize({
      // We will need the buyer to sign this transaction after it's returned to them
      requireAllSignatures: false
    })
    
    const base64 = serializedTransaction.toString('base64')

    // Insert into database: reference, amount
    await db.checkout.update({status: 'pending', pubkey:pubkey.toString()},{ where: {checkoutId: req.query.id}})
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
    
    let amount = config.price
    if (!await checkout){amount = null}
    
    
    return amount;
}

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('-');
}


async function checkstatus(){
    try {


        // 10 min = 600000 // 40 sec = 40000
        let time = 600000



        // Started
        let started = await db.checkout.findAndCountAll({where:{status: 'started'}, raw:true})
        await started.rows.forEach(async (rows, i) => {
    
            let now = Date.now()
            if(now - new Date(await started.rows[i].createdAt).getTime() >= time ){
                await db.checkout.destroy({where:{checkoutId: await started.rows[i].checkoutId}});
                console.log(await started.rows[i].checkoutId + ' Deleted');
                await fs.rm(__dirname + '/files/qrcodes/' + await started.rows[i].checkoutId + '.png')
            };
            
        }) 

        // Pending
        let pending = await db.checkout.findAndCountAll({where:{status: 'pending'}, raw:true})
        await pending.rows.forEach(async (rows, i) => {
            
                try {
                    let amount = await calculatePrice(await pending.rows[i].checkoutId)*0.1

                    if (!amount){return}

                    let reference = new PublicKey(await pending.rows[i].pubkey)
                    // Check if there is any transaction for the reference
                    const signatureInfo = await findReference(connection, reference, { finality: 'confirmed' })
                    // Validate that the transaction has the expected recipient, amount and SPL token

                    await validateTransfer(
                      connection,
                      signatureInfo.signature,
                      {
                        recipient: MERCHANT_WALLET,//await getAssociatedTokenAddress(splToken, MERCHANT_WALLET, true,),
                        amount,
                        splToken: splToken,
                        reference,

                      },
                      { commitment: 'confirmed' }
                    ).then(async (value)=>{
                        try {
                            await db.rsvp.create({ wallet:await pending.rows[i].pubkey, checkoutId: await pending.rows[i].checkoutId, fishtank: await pending.rows[i].fishtank, date: await pending.rows[i].date, period: await pending.rows[i].period})
                            await db.checkout.destroy({where:{checkoutId: await pending.rows[i].checkoutId}});
                            await fs.rm(__dirname + '/files/qrcodes/' + await pending.rows[i].checkoutId + '.png')
                            //email: pending.rows[i].email,
                        } catch (error) {
                            console.log(error)
                            
                        }
                    }, (reason)=>{
                        console.log(reason)
                    }
                        
                        
                    
                    )
                

                } catch (e) {
                    if(e instanceof FindReferenceError){
                        return
                    }

                    if (e instanceof ValidateTransferError) {
                        // Transaction is invalid
                        console.log('Transaction is invalid', e)
                        return;
                    }

                    console.log(e)

                }



            
            let now = Date.now()
            if(now - new Date(await pending.rows[i].createdAt).getTime() >= time ){
                await db.checkout.destroy({where:{checkoutId: await pending.rows[i].checkoutId}});
                console.log(await pending.rows[i].checkoutId + ' Deleted');
                await fs.rm(__dirname + '/files/qrcodes/' + await pending.rows[i].checkoutId + '.png')
            };

        }) 

    } catch (err) {
        console.log(err)
        
    }


    setTimeout(arguments.callee, 10000)
    
}






//  alter: true
//{force: true}
db.sequelize.sync().then(()=>{
    app.listen(config.port, ()=>{
        console.log(main_url)
        checkstatus()
        console.log('Started!')
    })
})

