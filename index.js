require('dotenv').config()

const { makeBatchRequest } = require('web3-batch-request');

const { GoogleSpreadsheet } = require('google-spreadsheet')
const axios = require('axios');
const { bscFactorContact, bscProjectContact, bscBUSDContact, bscWBNBContact, networks } = require('./contracts')
const ABIMAIN = require('./contracts/ABIMAIN.json')
const PROJECTABI = require('./contracts/PROJECTABI.json')
const REGISTERABI = require('./contracts/REGISTERABI.json')
const ABIMCAP = require('./contracts/MCAP.json')
const FACTORYABI = require('./contracts/FACTORYABI.json')
const PAIRABI = require('./contracts/PAIRABI.json')
const Web3 = require("web3")
const { getPair, getBalanceWBNB, getMCap } = require('./web3Api');

const doc = new GoogleSpreadsheet(process.env.APP_SPREADSHEET_ID)

const web3 = new Web3(networks.bsc_main)

class BitQueryFetchToGoogleSheet {
    BQ_URL = 'https://graphql.bitquery.io/'
    bnbPrice = 0
    start = 0
    isProcessing = false

    run() {
        this.start = (new Date).valueOf()
        this.getBNBCost(this.start);
        this.isProcessing = true
    }

    getBNBCost(start) {
        const query = `
            {
              ethereum(network: bsc) {
                dexTrades(
                  options: {desc: ["block.height","tradeIndex"], limit: 1}
                  exchangeName: {in: ["Pancake", "Pancake v2"]}
                  baseCurrency: {is: "${bscWBNBContact}"}
                  quoteCurrency: {is: "${bscBUSDContact}"}
              ) {
                  tradeIndex
                  block {
                    height
                  }
                  quotePrice
                }
              }
            }
            `;
        axios({
            method: 'post',
            url: this.BQ_URL,
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': `${process.env.APP_BTQUERY}`,
            },
            data: JSON.stringify({
                query
            })
        }).then(({ data }) => {
            this.bnbPrice = data.data.ethereum.dexTrades[0].quotePrice
            console.log(`Get BNB price in ${(new Date).valueOf() - start}ms`)
            this.runService()
        }).catch((e) => {
            console.log(e)
            console.log('Error to get price bnb')
        })
    }

    getTokenData(address, callback, time, prevData) {
        let secondCall = false
        let from = time
        if (!time) {
            time = new Date
            secondCall = true
            from = new Date('2020-01-01')
        }

        const query = `
        {
            ethereum(network: bsc) {
              dexTrades(
                options: {limit: 1, desc: "timeInterval.minute"}
                baseCurrency: {is: "${address}"}
                time: {before: "${time.toISOString()}"}
              ) {
                timeInterval {
                  minute(count: 1)
                }
                baseCurrency {
                  symbol
                  address
                  name
                }
                quoteCurrency {
                  symbol
                  address
                }
                quotePrice
                median_price: quotePrice(calculate: median)
                maximum(of: quote_price)
                minimum(of: quote_price)
              }
              transfers(
                currency: {is: "${address}"}
                amount: {gt: 0}
                date: {till: "${(secondCall ? time : new Date).toISOString()}", since: "${(secondCall ? from : time).toISOString()}"}
              ) {
                days: count(uniq: dates)
                sender_count: count(uniq: senders)
                receiver_count: count(uniq: receivers)
                min_date: minimum(of: date)
                max_date: maximum(of: date)
              }
            }
          }
          
        `;
        axios({
            method: 'post',
            url: this.BQ_URL,
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': `${process.env.APP_BTQUERY}`,
            },
            data: JSON.stringify({
                query
            })
        }).then(({ data }) => {
            if (secondCall) {
                setTimeout(() => {
                    this.getTokenData(address, callback, new Date(time.valueOf() - 86400000), data.data)
                }, 100000);
            } else {
                if (callback) callback(prevData, data.data)
            }
        }).catch((e) => {
            console.log(`Error to get price ${address}`)
            console.log(e)
            setTimeout(() => {
                if (callback) callback()
            }, 100000);
        })
    }

    async runService() {
        await doc.useServiceAccountAuth({
            client_email: process.env.APP_CLIENT_EMAIL,
            private_key: process.env.APP_PRIVATE_KEY,
        })
        await doc.loadInfo()
        const sheet = doc.sheetsById[process.env.APP_SHEET_ID]
        const rows = await sheet.getRows()
        // rows.reverse()
        this.fetchDataFromBitquery(rows)
    }

    fetchDataFromBitquery(data) {
        console.log(data.length)
        const execOne = async (item, step) => {
            console.log(step)
            if (step < data.length) {
                step++;
            } else {
                await this.batchWeb3Request(data)
                console.log(`Total finished in ${(new Date).valueOf() - this.start}ms`)
                return true
            }

            this.getTokenData(item.Project_Address, async (tokenData, prev24H) => {
                if (tokenData) {
                    let price24H = 0

                    try {
                        item.Project_Price = this.bnbPrice * tokenData.ethereum.dexTrades[0].quotePrice
                    } catch (e) {
                    }
                    try {
                        price24H = this.bnbPrice * prev24H.ethereum.dexTrades[0].quotePrice
                    } catch (e) {
                        price24H = 0
                    }
                    try {
                        item.Project_Holder = tokenData.ethereum.transfers[0].receiver_count - tokenData.ethereum.transfers[0].sender_count
                    } catch (e) {
                    }
                    try {
                        item.Project_HolderGrowth = prev24H.ethereum.transfers[0].receiver_count - prev24H.ethereum.transfers[0].sender_count
                    } catch (e) {
                    }
                    if (item.Project_Price) {
                        item.Project_Price_24h = (item.Project_Price - price24H) / item.Project_Price * 100
                    }
                    try {
                        item.save();
                    } catch (e) { }
                    console.log(item.Project_Price, price24H, item.Project_Holder, item.Project_Price_24h, item.Project_HolderGrowth)
                }
                setTimeout(() => {
                    execOne(data[step], step)
                }, 3000);
            })
        }

        execOne(data[0], 0)
        this.isProcessing = false
    }

    async batchWeb3Request(data) {
        let pairCalls = []
        let isActiveCalls = []
        let totalSpyCalls = []
        let decimalsCalls = []
        let votesCalls = []
        data.map(e => {
            pairCalls.push({
                ethCall: new web3.eth.Contract(FACTORYABI, bscFactorContact).methods.getPair(bscWBNBContact, e.Project_Address).call,
                onSuccess: result => console.log(`${e.Project_Address} ===pair===> ${result}`),
                onError: () => { console.log(`get pair error of ${e.Project_Address}`) }
            })
            isActiveCalls.push({
                ethCall: new web3.eth.Contract(PROJECTABI, bscProjectContact).methods.isActive(e.Project_Address).call,
                onSuccess: result => console.log(`${e.Project_Address} ===status===> ${result}`),
                onError: () => { console.log(`get active status error of ${e.Project_Address}`) }
            })
            totalSpyCalls.push({
                ethCall: new web3.eth.Contract(ABIMCAP, e.Project_Address).methods.totalSupply().call,
                onSuccess: result => console.log(`${e.Project_Address} ===mcap===> ${result}`),
                onError: () => { console.log(`get market cap error of ${e.Project_Address}`) }
            })
            decimalsCalls.push({
                ethCall: new web3.eth.Contract(ABIMCAP, e.Project_Address).methods.decimals().call,
                onSuccess: result => console.log(`${e.Project_Address} ===mcap===> ${result}`),
                onError: () => { console.log(`get market cap error of ${e.Project_Address}`) }
            })
            votesCalls.push({
                ethCall: new web3.eth.Contract(PROJECTABI, bscProjectContact).methods.getVotesPerProject(e.Project_Address).call,
                onSuccess: result => console.log(`${e.Project_Address} ===votes===> ${result}`),
                onError: () => { console.log(`get bnb balance of ${e.Project_Address}`) }
            })
        })
        let pairs = []
        let totalSupplies = []
        let decimals = []
        let votes = []
        try {
            pairs = await makeBatchRequest(web3, pairCalls, { allowFailures: true, verbose: true })
        } catch (e) { }
        // const statusArray = await makeBatchRequest(web3, isActiveCalls, { allowFailures: true, verbose: true })
        try {
            totalSupplies = await makeBatchRequest(web3, totalSpyCalls, { allowFailures: true, verbose: true })
        } catch (error) { }
        try {
            decimals = await makeBatchRequest(web3, decimalsCalls, { allowFailures: true, verbose: true })
        } catch (error) { }
        try {
            votes = await makeBatchRequest(web3, votesCalls, { allowFailures: true, verbose: true })
        } catch (error) { }

        let bnbBalanceCalls = []
        let mcaps = []
        data.map((token, i) => {
            if (pairs[i]) {
                bnbBalanceCalls.push({
                    ethCall: new web3.eth.Contract(PAIRABI, bscWBNBContact).methods.balanceOf(pairs[i].value).call,
                    onSuccess: result => console.log(`${token.Project_Address} ===bnb===> ${result}`),
                    onError: () => { console.log(`get bnb balance of ${token.Project_Address}`) }
                })
            }
            if (token.Project_Price) {
                try {
                    let price = token.Project_Price.replace ? token.Project_Price.replace(',', '.') : token.Project_Price
                    mcaps.push((totalSupplies[i].value / 10 ** decimals[i].value) * price)
                } catch (e) { }
            }

        })
        let bnbBalances = []
        try {
            bnbBalances = await makeBatchRequest(web3, bnbBalanceCalls, { allowFailures: true, verbose: true })
        } catch (error) { }
        data.map(async (item, i) => {
            item.Project_MarketCap = mcaps[i]
            try {
                item.Project_Upvotes = votes[i].value[0]
                item.Project_MedVotes = votes[i].value[1]
                item.Project_Downvotes = votes[i].value[2]
            } catch (e) { }
            try {
                item.Project_LiqMcapRatio = web3.utils.fromWei(bnbBalances[i].value, 'ether') * this.bnbPrice / mcaps[i] * 100;
            } catch (e) { }
            await new Promise(resolve => setTimeout(() => {
                try {
                    item.save();
                } catch (e) {
                    console.log(`Save Error contract ${item.Project_Address}`)
                }
                resolve()
            }, 3000));
        })

    }

}

const instance = new BitQueryFetchToGoogleSheet;
instance.run()
const cron = require('node-cron')
cron.schedule('*/30 * * * *', () => {
    if(!instance.isProcessing) {
        instance.run()
    }
}); 