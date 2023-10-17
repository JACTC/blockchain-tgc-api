const express = require('express')
const db = require('./models/index')
const { rsvp } = require('./models')
const QRCode= require('qrcode')


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




app.get('/api/get/fishtank/:id', async (req, res)=>{
    const fishtanks = ['1','2','3','4']
    try {
        const reservations = await rsvp.findAll({where:{ fishtank:req.params.id}})
    } catch (error) {
        console.log(error)
    }


    res.send(reservations)
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
        const reservation = await db.rsvp.create({ name: req.body.name, wallet:req.body.wallet, hash:req.body.hash, fishtank:req.body.fishtank, start:req.body.start, end:req.body.end})
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

        let url = encodeURL({link:'https://v57nr3jh-3000.uks1.devtunnels.ms/?id=' + checkout.checkoutId})

       //let qr = createQR(url, 512, 'white', 'black').download(__dirname + '/files/qrcodes/' + checkout.checkoutId + '.svg')
        QRCode.toFile(__dirname +'/files/qrcodes/' + checkout.checkoutId + '.png', url.href, { errorCorrectionLevel: 'M' })


        res.send({ checkoutId:checkout.checkoutId, qr:'https://v57nr3jh-3000.uks1.devtunnels.ms' + '/files/qrcodes/' + checkout.checkoutId + '.png', url:url })
    } catch (error) {
        console.log(error)
        res.sendStatus(500)
    }
    
    
})



// Solana pay

app.get('/', (req, res)=>{
    const icon = 'https://https://v57nr3jh-3000.uks1.devtunnels.ms/label.svg'
    res.send({"label":"Fishtanks Reservations", "icon":icon})
})

app.get('/label.svg', (req, res)=>{
    res.sendFile(__dirname + '/files/icon.svg')
})



app.post('/', async (req,res)=>{
try {

        
        const reference = req.query.id.toString()
        if(!reference) throw new Error('no reference')

    
    // Account provided in the transaction request body by the wallet.
        const accountField = req.body.account;
        if (!accountField) throw new Error('missing account');
    
        const sender = new PublicKey(accountField);
        console.log(sender)
    
        // create spl transfer instruction
    
        const splTransferIx = await createSplTransferIx(sender);
    
    
        splTransferIx.keys.push({
            pubkey: new PublicKey(reference),
            isSigner: false,
            isWritable: false,
          })
        // create the transaction
        const transaction = new Transaction();
    
        
        // add the instruction to the transaction
        transaction.add(splTransferIx);
    
        let blockhash = (await connection.getLatestBlockhash('finalized')).blockhash;
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = MERCHANT_WALLET
    
    
        // Serialize and return the unsigned transaction.
        const serializedTransaction = transaction.serialize({
            verifySignatures: false,
            requireAllSignatures: false,
        });
    
        const base64Transaction = serializedTransaction.toString('base64');
        const message = 'Thank you for your Reservation of a fishtank';
    
        res.status(200).send({ transaction: base64Transaction, message });
} catch (error) {
    res.sendStatus(500)
    console.log(error)
}
})





async function createSplTransferIx(sender) {
    //const senderInfo = await connection.getAccountInfo(sender);
    //if (!senderInfo) throw new Error('sender not found');

    // Get the sender's ATA and check that the account exists and can send tokens
    const senderATA = await getAssociatedTokenAddress(splToken, sender);
    const senderAccount = await getAccount(connection, senderATA);
    if (!senderAccount.isInitialized) throw new Error('sender not initialized');
    if (senderAccount.isFrozen) throw new Error('sender frozen');

    // Get the merchant's ATA and check that the account exists and can receive tokens
    const merchantATA = await getAssociatedTokenAddress(splToken, MERCHANT_WALLET);
    const merchantAccount = await getAccount(connection, merchantATA);
    if (!merchantAccount.isInitialized) throw new Error('merchant not initialized');
    if (merchantAccount.isFrozen) throw new Error('merchant frozen');

    // Check that the token provided is an initialized mint
    const mint = await getMint(connection, splToken);
    if (!mint.isInitialized) throw new Error('mint not initialized');

    // You should always calculate the order total on the server to prevent
    // people from directly manipulating the amount on the client
    let amount = calculateCheckoutAmount();

    // Check that the sender has enough tokens
    //const tokens = BigInt(String(amount));
    //if (tokens > senderAccount.amount) throw new Error('insufficient funds');
    if (amount.toString() > senderAccount.amount) throw new Error('insufficient funds');
    // Create an instruction to transfer SPL tokens, asserting the mint and decimals match
    const splTransferIx = createTransferCheckedInstruction(
        senderATA,
        splToken,
        merchantATA,
        sender,
        amount,
        mint.decimals
    );

    // Create a reference that is unique to each checkout session
    const references = [new Keypair().publicKey];

    // add references to the instruction
    for (const pubkey of references) {
        splTransferIx.keys.push({ pubkey, isWritable: false, isSigner: false });
    }

    return splTransferIx;
}



function calculateCheckoutAmount() {
    let amount = 5
    
    return amount;
}

// TODO: Checkout calculatibng and calculateCheckoutAmount(), reservation handeling
// maybe periods instaed of times?







//  alter: true
db.sequelize.sync({force: true}).then(()=>{
    app.listen(3000, ()=>{
        console.log('http://localhost:3000')
    })
})

