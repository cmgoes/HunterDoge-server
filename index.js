require('dotenv').config()

const {GoogleSpreadsheet} = require('google-spreadsheet')
const axios = require('axios');

const doc = new GoogleSpreadsheet(process.env.APP_SPREADSHEET_ID)
const bscWBNBContact = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'
const bscBUSDContact = '0xe9e7cea3dedca5984780bafc599bd69add087d56'

class BitQueryFetchToGoogleSheet {
    BQ_URL = 'https://graphql.bitquery.io/'
    bnbPrice = 0
    start = 0

    run() {
        this.start = (new Date).valueOf()
        this.getBNBCost(this.start);
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
                'X-API-KEY': 'BQY5mlmDJffK8raT64INp3RTSCC4FiWA',
            },
            data: JSON.stringify({
                query
            })
        }).then(({data}) => {
            console.log(`Get BNB price in ${(new Date).valueOf() - start}ms`)
            setTimeout(() => {console.log("10s Break")}, 100000);
            this.bnbPrice = data.data.ethereum.dexTrades[0].quotePrice
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
                  ) {
                    timeInterval {
                      minute(count: 1)
                    }
                    baseCurrency {
                      symbol
                      address
                      name
                    }
                    baseAmount
                    quoteCurrency {
                      symbol
                      address
                    }
                    quoteAmount
                    trades: count
                    quotePrice
                    median_price: quotePrice(calculate: median)
                  }
                }
              }
        `;
        axios({
            method: 'post',
            url: this.BQ_URL,
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': 'BQYPmFV77w7X2svaoXx3UXLrSF2doQHV',
            },
            data: JSON.stringify({
                query
            })
        }).then(({data}) => {
            if (secondCall) {
                setTimeout(() => {console.log("10s Break")}, 100000);
                this.getTokenData(address, callback, new Date(time.valueOf() - 86400000), data.data)
            } else {
                if (callback) callback(prevData, data.data)
            }
        }).catch((e) => {
            console.log(`Error to get price ${address}`)
            setTimeout(() => {console.log("10s Break")}, 100000);
            if (callback) callback()
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

        this.fetchDataFromBitquery(rows)
    }

    fetchDataFromBitquery(data) {
        console.log(data.length)
        const execOne = (item, step) => {
            console.log(step)
            if (step < data.length) {
                step++;
            } else {
                console.log(`Total finished in ${(new Date).valueOf() - this.start}ms`)
                return true
            }
            this.getTokenData(item.Project_Address, (tokenData, prev24H) => {
                if (tokenData) {
                    let price24H, holder24H = 0

                    try {
                        item.Project_Price = this.bnbPrice * tokenData.ethereum.dexTrades[0].quotePrice
                        setTimeout(() => {console.log("10s Break")}, 100000);
                    } catch (e) {
                        setTimeout(() => {console.log("10s Break")}, 100000);
                    }
                    try {
                        price24H = this.bnbPrice * prev24H.ethereum.dexTrades[0].quotePrice
                        setTimeout(() => {console.log("10s Break")}, 100000);
                    } catch (e) {
                        setTimeout(() => {console.log("10s Break")}, 100000);
                        price24H = 0
                    }
                    try {
                        item.Project_Holder = tokenData.ethereum.transfers[0].receiver_count - tokenData.ethereum.transfers[0].sender_count
                        setTimeout(() => {console.log("10s Break")}, 100000);
                    } catch (e) {
                        setTimeout(() => {console.log("10s Break")}, 100000);
                    }
                    try {
                        item.Project_HolderGrowth = prev24H.ethereum.transfers[0].receiver_count - prev24H.ethereum.transfers[0].sender_count
                        setTimeout(() => {console.log("10s Break")}, 100000);
                    } catch (e) {
                        setTimeout(() => {console.log("10s Break")}, 100000);
                        holder24H = 0
                    }
                    item.Project_Price_24h = (item.Project_Price || 0) - price24H
                    item.save();
                    console.log(item.Project_Price, item.Project_Holder, item.Project_Price_24h, item.Project_HolderGrowth)
                }
                setTimeout(() => {
                    execOne(data[step], step)
                }, 3000);
            })

        }

        execOne(data[0], 0)
    }
}

const instance = new BitQueryFetchToGoogleSheet;
instance.run()
const cron = require('node-cron')
cron.schedule('0 */1 * * *', () => {
    run()
}); 