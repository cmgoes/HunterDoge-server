const Web3 = require("web3")
const { bscFactorContact, bscMembershipContract, bscProjectContact, bscTokenContact, bscWBNBContact, networks } = require('./contracts')
const ABIMAIN = require('./contracts/ABIMAIN.json')
const PROJECTABI = require('./contracts/PROJECTABI.json')
const REGISTERABI = require('./contracts/REGISTERABI.json')
const ABIMCAP = require('./contracts/MCAP.json')
const FACTORYABI = require('./contracts/FACTORYABI.json')
const PAIRABI = require('./contracts/PAIRABI.json')

const web3 = new Web3(networks.bsc_main)
module.exports = {
    getUserVotes: async (account) => {
        const contract = new web3.eth.Contract(ABIMAIN, bscMembershipContract);
        const votes = await contract.methods.getUserVotes(account).call();
        return votes
    }
    ,
    getVotesPerProject: async (address) => {
        const contract = new web3.eth.Contract(PROJECTABI, bscProjectContact);
        try {
            const isActive = await contract.methods.isActive(address).call()
            if (isActive) {
                return await contract.methods.getVotesPerProject(address).call()
            }
        } catch (e) {
            console.warn('error', e)
        }
    }
    ,
    downVoteProject: async (ethereum, vote, account, address) => {
        const web3_ = new Web3(ethereum)
        const contract = new web3_.eth.Contract(PROJECTABI, bscProjectContact);
        try {

            await contract.methods
                .downVoteProject(vote, address)
                .send({ from: account })
        } catch (e) {
            alert('Voting failed - Ensure that you are Connected :)');
        }
    }
    ,
    upVoteProject: async (ethereum, vote, account, address) => {
        const web3_ = new Web3(ethereum)
        const contract = new web3_.eth.Contract(PROJECTABI, bscProjectContact);

        try {
            await contract.methods
                .upVoteProject(vote, address)
                .send({ from: account })

        } catch (e) {
            alert('Voting failed - Ensure that you are Connected :)');
        }
    }
    ,
    medVoteProject: async (ethereum, vote, account, address) => {
        const web3_ = new Web3(ethereum)
        const contract = new web3_.eth.Contract(PROJECTABI, bscProjectContact);

        try {
            await contract.methods
                .medVoteProject(vote, address)
                .send({ from: account })
        } catch (e) {
            alert('Voting failed - Ensure that you are Connected :)');
        }
    }
    ,
    buyVotes: async (ethereum, account, amount) => {
        const web3_ = new Web3(ethereum)
        const contract = new web3_.eth.Contract(ABIMAIN, bscMembershipContract);

        await contract.methods.buyVotes(amount)
            .send({ from: account })
            .on('receipt', function (receipt) {
                console.log('buy votes', receipt)
            })
            .on('error', function (error, receipt) {
                console.log(error)
            })
    }
    ,
    approveTokens: async (ethereum, account) => {
        const web3_ = new Web3(ethereum)
        const amount = '115792089237316195423570985008687907853269984665640564039457584007913129639935'
        const contract = new web3_.eth.Contract(REGISTERABI, bscTokenContact);

        await contract.methods
            .approve(bscMembershipContract, amount)
            .send({ from: account })
    }
    ,
    membership: async (ethereum, account) => {
        const web3_ = new Web3(ethereum)
        const contract = new web3_.eth.Contract(ABIMAIN, bscMembershipContract);

        await contract.methods
            .getMembership()
            .send({ from: account })
            .on('receipt', function (receipt) {
                console.log('member', receipt)
            })
            .on('error', function (error, receipt) {
                console.log(error)
            })
    }
    ,
    membershipCosts: async () => {
        const contract = new web3.eth.Contract(ABIMAIN, bscMembershipContract);
        try {
            const result = await contract.methods.membershipCosts().call()

            return web3.utils.fromWei(result)
        } catch (e) {
            console.log('membershipCosts', e)
        }


    }
    ,
    votePrice: async () => {
        const contract = new web3.eth.Contract(ABIMAIN, bscMembershipContract);
        try {
            const result = await contract.methods.votePrice().call()

            return web3.utils.fromWei(result)
        } catch (e) {
            console.log('membershipCosts', e)
        }
    }
    ,
    isMember: async (account) => {
        const contract = new web3.eth.Contract(ABIMAIN, bscMembershipContract);

        const data = await contract.methods
            .isMember(account)
            .call()
        return data
    }
    ,
    isProjectManager: async (tokenAddress, account) => {
        const contract = new web3.eth.Contract(PROJECTABI, bscProjectContact);
        let data = await contract.methods.ProjectStore(tokenAddress).call()
        if (data.ProjectManager === account) return true
        else return false
    }
    ,
    isManager: async (account) => {
        const contract = new web3.eth.Contract(PROJECTABI, bscProjectContact);
        let res = await contract.methods.Managers(account).call()
        return res
    }
    ,
    returnMembership: async (ethereum, account) => {
        const web3_ = new Web3(ethereum)
        const contract = new web3_.eth.Contract(ABIMAIN, bscMembershipContract);

        await contract.methods
            .returnMembership()
            .send({ from: account })
    }
    ,
    getMCap: async (address, price) => {

        try {
            const contract = new web3.eth.Contract(ABIMCAP, address);

            const total = await contract.methods
                .totalSupply()
                .call()

            const decimals = await contract.methods
                .decimals()
                .call()

            const mcap = (total / 10 ** decimals) * price
            return mcap
        } catch (error) {
            console.log(error)
            return 0
        }
    }
    ,
    getSymbol: async (address) => {
        try {
            const contract = new web3.eth.Contract(ABIMCAP, address);

            const symbol = await contract.methods
                .symbol()
                .call()
            return symbol
        } catch (error) {
            return ''
        }
    }
    ,
    getName: async (address) => {
        try {
            const contract = new web3.eth.Contract(ABIMCAP, address);

            const symbol = await contract.methods
                .name()
                .call()
            return symbol
        } catch (error) {
            return ""
        }
    }
    ,
    getPair: async (address) => {
        try {
            const contract = new web3.eth.Contract(FACTORYABI, bscFactorContact)

            const pair = await contract.methods.getPair(bscWBNBContact, address).call()
            return pair
        } catch (error) {
            return ''
        }
    }
    ,
    getBalanceWBNB: async (address) => {
        try {
            const contract = new web3.eth.Contract(PAIRABI, bscWBNBContact)

            const balance = await contract.methods.balanceOf(address).call()
            return web3.utils.fromWei(balance, 'ether')
        } catch (error) {
            console.log(error)
            return ''
        }
    }
    ,
    getBalanceToken: async (address, token) => {
        try {
            const contract = new web3.eth.Contract(PAIRABI, token)
            let decimals_local = await contract.methods.decimals().call()
            let balance = await contract.methods.balanceOf(address).call()
            return (balance / 10 ** decimals_local)
        } catch (error) {
            console.log(error)
            return ''
        }
    }

    ,
    isHoneypot: async (address) => {
        let bnbIN = 1000000000000000000;
        let maxTXAmount = 0;
        let maxSell = 0;
        const hWeb3 = new Web3(networks.bsc_main);
        const getBNBIn = async (address) => {
            let amountIn = maxTXAmount;
            if (maxSell != 0) {
                amountIn = maxSell;
            }
            let WETH = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
            let path = [address, WETH];
            let sig = hWeb3.eth.abi.encodeFunctionCall({
                name: 'getAmountsOut',
                type: 'function',
                inputs: [
                    { type: 'uint256', name: 'amountIn' },
                    { type: 'address[]', name: 'path' },
                ],
                outputs: [
                    { type: 'uint256[]', name: 'amounts' },
                ],
            }, [amountIn, path]);

            let d = {
                to: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
                from: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
                value: 0,
                gas: 15000000,
                data: sig,
            };
            try {
                let val = await hWeb3.eth.call(d);
                let decoded = hWeb3.eth.abi.decodeParameter('uint256[]', val);
                bnbIN = hWeb3.utils.toBN(decoded[1]);
            } catch (e) {
                console.log(e);
            }
        }

        const getMaxes = async () => {
            let sig = hWeb3.eth.abi.encodeFunctionSignature({ name: '_maxTxAmount', type: 'function', inputs: [] });
            let d = {
                to: address,
                from: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
                value: 0,
                gas: 15000000,
                data: sig,
            };
            try {
                let val = await hWeb3.eth.call(d);
                maxTXAmount = hWeb3.utils.toBN(val);
            } catch (e) {
                sig = hWeb3.eth.abi.encodeFunctionSignature({
                    name: 'maxSellTransactionAmount',
                    type: 'function',
                    inputs: []
                });
                let d = {
                    to: address,
                    from: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
                    value: 0,
                    gas: 15000000,
                    data: sig,
                };
                try {
                    let val2 = await hWeb3.eth.call(d);
                    maxSell = hWeb3.utils.toBN(val2);
                } catch (e) {

                }
            }
        }
        await getMaxes();
        if (maxTXAmount != 0 || maxSell != 0) {
            await getBNBIn(address);
        }

        let encodedAddress = hWeb3.eth.abi.encodeParameter('address', address);
        let contractFuncData = '0xd66383cb';
        let callData = contractFuncData + encodedAddress.substring(2);

        let blacklisted = {
            '0xa914f69aef900beb60ae57679c5d4bc316a2536a': 'SPAMMING SCAM',
            '0x105e62565a31c269439b29371df4588bf169cef5': 'SCAM',
            '0xbbd1d56b4ccab9302aecc3d9b18c0c1799fe7525': 'Error: TRANSACTION_FROM_FAILED'
        };
        let unableToCheck = {
            '0x54810d2e8d3a551c8a87390c4c18bb739c5b2063': 'Coin does not utilise PancakeSwap',
            '0xc0834ee3f6589934dc92c63a893b4c4c0081de06': 'Due to anti-bot, Honeypot is not able to check at the moment.'
        };

        if (blacklisted[address.toLowerCase()] !== undefined) {
            return { is: 'Yes', buy_tax: 0, sell_tax: 0 }
        }
        if (unableToCheck[address.toLowerCase()] !== undefined) {
            return { is: 'Unknown', buy_tax: 0, sell_tax: 0 }
        }

        let value = 100000000000000000;
        if (bnbIN < value) {
            value = bnbIN - 1000;
        }
        const val = await hWeb3.eth.call({
            to: '0x2bf75fd2fab5fc635a4c6073864c708dfc8396fc',
            from: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
            value: value,
            gas: 45000000,
            data: callData,
        })
        let decoded = hWeb3.eth.abi.decodeParameters(['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'], val);
        let buyExpectedOut = hWeb3.utils.toBN(decoded[0]);
        let buyActualOut = hWeb3.utils.toBN(decoded[1]);
        let sellExpectedOut = hWeb3.utils.toBN(decoded[2]);
        let sellActualOut = hWeb3.utils.toBN(decoded[3]);
        const buy_tax = Math.round((buyExpectedOut - buyActualOut) / buyExpectedOut * 100 * 10) / 10;
        const sell_tax = Math.round((sellExpectedOut - sellActualOut) / sellExpectedOut * 100 * 10) / 10;

        return { is: 'No', buy_tax: buy_tax, sell_tax: sell_tax }
    }

    ,
    toChecksumAddress: (address) => {
        try {
            return web3.utils.toChecksumAddress(address)
        } catch (error) {
            console.log(error)
            return ''
        }
    }
}