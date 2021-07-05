const { BN } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const M = require('minimatch');
const { execPath } = require('process');
const web3 = require('web3');
const Kindly = artifacts.require("Kindly")
const toBN = web3.utils.toBN;

contract("Kindly", accounts => {
    var charityAddressMock;
    var devAddressMock;
    var pancakeFactoryMock;
    var pancakeRouterMock;
    var contract;

    beforeEach(async function() {
        charityMock = accounts[7];
        devMock = accounts[8];
        liquidityWalletMock = accounts[9];

        /*pancakeFactoryMock = await MockContract.new();
        const createPairMethod = web3.utils.sha3("transfecreatePairrFrom(address,address)").slice(0,10) // first 4 bytes
        await pancakeFactoryMock.givenMethodReturnAddress(createPairMethod,"0xD99D1c33F9fC3444f8101754aBC46c52416550D1");

        pancakeRouterMock = await MockContract.new();
        const WETHMethod = web3.utils.sha3("WETH()").slice(0,10) // first 4 bytes
        const factoryMethod = web3.utils.sha3("factory()").slice(0,10) // first 4 bytes
        
        await pancakeRouterMock.givenMethodReturnAddress(WETHMethod, "0xD99D1c33F9fC3444f8101754aBC46c52416550D1");
        await pancakeRouterMock.givenMethodReturnAddress(factoryMethod, pancakeFactoryMock.address);*/

        contract = await Kindly.new(charityMock, devMock, liquidityWalletMock);
    });

    async function getReflectionFromToken(tokens) {
        totalSupply = await contract.totalSupply();
        rSupply = await contract.totalRSupply();
        rate = rSupply.div(totalSupply);
        return tokens.mul(rate);
    }

    async function getTokensFromReflection(rTokens, tTokensToAdjust, rTokensToAdjust) {
        totalSupply = await contract.totalSupply();
        rSupply = await contract.totalRSupply();

        if (typeof tTokensToAdjust != "undefined") {
            totalSupply = totalSupply.sub(tTokensToAdjust);
        }

        if (typeof rTokensToAdjust != "undefined") {
            rSupply = rSupply.sub(rTokensToAdjust);
        }

        rate = rSupply.div(totalSupply);
        return rTokens.div(rate);
    }

    describe("setup", async() => {
        
        it("should have Kindly as name", async() => {
            expect(await contract.name()).to.be.equal("Kindly");
        });
        it("should have KINDLY as symbol", async() => {
            expect(await contract.symbol()).to.be.equal("KINDLY");
        });
        it("should have 18 decimals", async() => {
            expect(await contract.decimals()).to.be.bignumber.equal("18");
        });
        it("should have 108 million of total supply", async () => {
            totalSupply = await contract.totalSupply();
            expect(totalSupply).to.be.bignumber.equal(web3.utils.toWei("108000000"));
        });
        it("should have 108 million * 0.005 of max transaction amount", async () => {
            maxTxAmount = (await contract._maxTxAmount()).toString();
            maxTxAmountCalculatedWithTotalSupply = (await contract.totalSupply()).mul(web3.utils.toWei(toBN("5"))).div(web3.utils.toWei(toBN("1000"))).toString();
            expect(maxTxAmount).to.be.bignumber.equal(maxTxAmountCalculatedWithTotalSupply);
        });
        it("should have 0.3% tax fee", async() => {
            expect(await contract._taxFee()).to.be.bignumber.equal("30");
        });
        it("should have 2.65% charity fee", async() => {
            expect(await contract._charityFee()).to.be.bignumber.equal("265");
        });
        it("should have 0.75% dev fee", async() => {
            expect(await contract._devFee()).to.be.bignumber.equal("75");
        });
        it("should have 0.3% liquidity wallet fee", async() => {
            expect(await contract._liquidityWalletFee()).to.be.bignumber.equal("30");
        });   
        it("should have 0% liquidity fee", async() => {
            expect(await contract._liquidityFee()).to.be.bignumber.equal("0");
        });
        it("should not allow to change dev wallet address", async() => {
            hasError = false;
            try {
                await contract.setDevAddress(accounts[4], {from: accounts[2]});
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Ownable: caller is not the owner")).to.be.greaterThanOrEqual(0);
            }
            expect(hasError).to.be.equal(true);
            expect(await contract.dev()).to.be.equal(devMock);
        });

        it("should not allow to change charity wallet address", async() => {
            hasError = false;
            try {
                await contract.setCharityAddress(accounts[4], {from: accounts[2]});
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Ownable: caller is not the owner")).to.be.greaterThanOrEqual(0);
            }
            expect(hasError).to.be.equal(true);
            expect(await contract.charity()).to.be.equal(charityMock);
        });

        it("should not allow to change liquidity wallet address", async() => {
            hasError = false;
            try {
                await contract.setLiquidityWalletAddress(accounts[4], {from: accounts[2]});
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Ownable: caller is not the owner")).to.be.greaterThanOrEqual(0);
            }
            expect(hasError).to.be.equal(true);
            expect(await contract.liquidityWallet()).to.be.equal(liquidityWalletMock);
        });
    });

    describe("transfers", async() => {
        it("should transfer balance to another account", async () => {
            creatorInitialAccountBalance = await contract.balanceOf(accounts[0]);        
            initialAccountBalance = await contract.balanceOf(accounts[1]);
            
            await contract.transfer(accounts[1], 10000);
    
            finalAccountBalance = await contract.balanceOf(accounts[1]);
            creatorFinalAccountBalance = await contract.balanceOf(accounts[0]);
    
            expect(initialAccountBalance).to.be.bignumber.equal('0');        
            expect(finalAccountBalance).to.be.bignumber.equal('10000');
            expect(creatorFinalAccountBalance).to.be.bignumber.equal(creatorInitialAccountBalance.sub(toBN('10000')));
        });

        it("should increment holders balance when transaction occurs by the reflection amount (1% among all owners)", async () => {
            // transfer amount to account1
            await contract.transfer(accounts[1], web3.utils.toWei("100"));
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);
            
            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("100"), {from: accounts[2]});

            tokensRelatedToReflection = web3.utils.toWei(toBN("100"));
            rTokensToAccount = await getReflectionFromToken(tokensRelatedToReflection);
        
            // calculate tokens from accounts excluded from rewards
            let tTokensToCharity = web3.utils.toWei(toBN("100")).mul(toBN("265")).div(toBN("10000"));
            let tTokensToDev = web3.utils.toWei(toBN("100")).mul(toBN("75")).div(toBN("10000"));
            let tTokensToLiquidity = web3.utils.toWei(toBN("100")).mul(toBN("30")).div(toBN("10000"));
            let rTokensToCharity = await getReflectionFromToken(tTokensToCharity);
            let rTokensToDev = await getReflectionFromToken(tTokensToDev);
            let rTokensToLiquidity = await getReflectionFromToken(tTokensToLiquidity);
            let tTokensToAdjust = tTokensToDev.add(tTokensToLiquidity).add(tTokensToCharity);
            let rTokensToAdjust = rTokensToDev.add(rTokensToLiquidity).add(rTokensToCharity);

            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("100"));

            holderFinalAccountBalance = await contract.balanceOf(accounts[1]);
            balanceFromReflection = await getTokensFromReflection(rTokensToAccount, tTokensToAdjust, rTokensToAdjust);

            expect(holderFinalAccountBalance).to.be.bignumber.equal(balanceFromReflection);
        });

        it("should not allow transfers with negative values", async () => {
            // transfer amount to account1
            await contract.transfer(accounts[1], web3.utils.toWei("100"));
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], web3.utils.toWei("1000"));

            holderInitialAccountBalance = await contract.balanceOf(accounts[1]);
            
            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("100"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            let hasError = false;
            try{
                await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("-1"));
            } catch(e) {
                hasError = true;
            }

            holderFinalAccountBalance = await contract.balanceOf(accounts[1]);            
            expect(holderFinalAccountBalance).to.be.bignumber.equal(holderInitialAccountBalance);
            expect(hasError).to.be.equal(true);
        });

        it("should not allow transfers with zero value", async () => {
            // transfer amount to account1
            await contract.transfer(accounts[1], web3.utils.toWei("100"));
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], web3.utils.toWei("1000"));

            holderInitialAccountBalance = await contract.balanceOf(accounts[1]);
            
            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("100"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            let hasError = false;
            try {
                await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("0"));
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("amount must be greater than zero")).to.be.greaterThanOrEqual(0);
            }

            holderFinalAccountBalance = await contract.balanceOf(accounts[1]);            
            expect(holderFinalAccountBalance).to.be.bignumber.equal(holderInitialAccountBalance);
            expect(hasError).to.be.equal(true);
        });

        it("should not allow transfers without allowance", async () => {
            // transfer amount to account1
            await contract.transfer(accounts[1], web3.utils.toWei("100"));
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], web3.utils.toWei("1000"));

            holderInitialAccountBalance = await contract.balanceOf(accounts[1]);
                    
            // transfer amount from account2 to account3
            let hasError = false;
            try {
                await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("100"));
            } catch (e) {
                hasError = true;
                expect(e.reason.indexOf("transfer amount exceeds allowance")).to.be.greaterThanOrEqual(0);
            }

            holderFinalAccountBalance = await contract.balanceOf(accounts[1]);            
            expect(holderFinalAccountBalance).to.be.bignumber.equal(holderInitialAccountBalance);
            expect(hasError).to.be.equal(true);
        });

        it("should not allow transfers with an allowance lower than the transfer", async () => {
            // transfer amount to account1
            await contract.transfer(accounts[1], web3.utils.toWei("100"));
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], web3.utils.toWei("1000"));

            holderInitialAccountBalance = await contract.balanceOf(accounts[1]);
            
            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("50"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            let hasError = false;
            try{
                await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("100"));
            }catch(e){
                hasError = true;
                expect(e.reason.indexOf("transfer amount exceeds allowance")).to.be.greaterThanOrEqual(0);
            }

            holderFinalAccountBalance = await contract.balanceOf(accounts[1]);            
            expect(holderFinalAccountBalance).to.be.bignumber.equal(holderInitialAccountBalance);
            expect(hasError).to.be.equal(true);
        });

        it("should not increment holders balance when transaction occurs if excluded from fee", async () => {
            // transfer amount to account1
            await contract.transfer(accounts[1], web3.utils.toWei("100"));
    
            // save balance
            holderInitialAccountBalance = await contract.balanceOf(accounts[1]);
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.excludeFromFee(accounts[2])
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);
    
            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("200"));
    
            // get current balance from account1
            holderFinalAccountBalance = await contract.balanceOf(accounts[1]);
            
            // transfer between account2 and account3 should add fee to account1
            expect(holderFinalAccountBalance).to.be.bignumber.equal(holderInitialAccountBalance);
        });

        it("should not add liquidity when transaction occurs", async () => {
            // save balance
            initialContractAccountBalance = await contract.balanceOf(contract.address);
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.includeInFee(accounts[2]);
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);
    
            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("100"));
    
            // get current balance from account1
            finalContractAccountBalance = await contract.balanceOf(contract.address);
            
            // transfer between account2 and account3 should add fee to account1
            expect(finalContractAccountBalance).to.be.bignumber.equal(initialContractAccountBalance);
        });

        it("should increase tOwned on transfer to excluded", async () => {
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.excludeFromReward(accounts[3]);
            //tOwnedInitialBalance = await contract.balanceOf(accounts[3]);
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[1], web3.utils.toWei("100"));

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("100"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transfer(accounts[3], web3.utils.toWei("100"), {from: accounts[2]});

            // get current balance from account1
            tOwnedFinalBalanceRecipient = await contract.balanceOf(accounts[3]);
            tOwnedFinalBalanceSender = await contract.balanceOf(accounts[2]);
            tOwnedFinalBalanceCheckAccount = await contract.balanceOf(accounts[1]);
            
            // transfer between account2 and account3 should add fee to account1
            expect(tOwnedFinalBalanceRecipient).to.be.bignumber.equal(web3.utils.toWei("96")); // 100 - 4% (charity dev and liquidity wallet fee)
            expect(tOwnedFinalBalanceSender).to.be.bignumber.equal(tOwnedFinalBalanceCheckAccount); // Check account should have the same balance as the sender account after the transfer 

        });

        it("should decrease tOwned on transfer from excluded", async () => {
            
            await contract.excludeFromReward(accounts[2]);
            //tOwnedInitialBalance = await contract.balanceOf(accounts[3]);
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[1], web3.utils.toWei("96"));

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("100"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transfer(accounts[3], web3.utils.toWei("100"), {from: accounts[2]});

            // get current balance from account1
            tOwnedFinalBalanceSender = await contract.balanceOf(accounts[2]);
            rOwnedFinalBalanceRecipient = await contract.balanceOf(accounts[3]);
            rOwnedFinalBalanceCheckAccount = await contract.balanceOf(accounts[1]);
            
            // transfer between account2 and account3 should add fee to account1
            expect(tOwnedFinalBalanceSender).to.be.bignumber.equal(web3.utils.toWei("100"));
            expect(rOwnedFinalBalanceRecipient).to.be.bignumber.equal(rOwnedFinalBalanceCheckAccount); // Check account should have the same balance as the sender account after the transfer 

        });

        it("should decrease tOwned on both sender and recipient on both excluded", async () => {
            
            await contract.excludeFromReward(accounts[2]);
            await contract.excludeFromReward(accounts[3]);
            
            await contract.transfer(accounts[2], web3.utils.toWei("200"));

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("100"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transfer(accounts[3], web3.utils.toWei("100"), {from: accounts[2]});

            // get current balance from account1
            tOwnedFinalBalanceSender = await contract.balanceOf(accounts[2]);
            tOwnedFinalBalanceRecipient = await contract.balanceOf(accounts[3]);
            
            // transfer between account2 and account3 should add fee to account1
            expect(tOwnedFinalBalanceSender).to.be.bignumber.equal(web3.utils.toWei("100"));
            expect(tOwnedFinalBalanceRecipient).to.be.bignumber.equal(web3.utils.toWei("96")); // Check account should have the same balance as the sender account after the transfer 

        });
        
        it("should allow max tx transfer", async () => {
            
            
            await contract.transfer(accounts[2], web3.utils.toWei("540000"));

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("540000"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transfer(accounts[3], web3.utils.toWei("540000"), {from: accounts[2]});

            tOwnedFinalBalanceSender = await contract.balanceOf(accounts[2]);
            
            // transfer between account2 and account3 should add fee to account1
            expect(tOwnedFinalBalanceSender).to.be.bignumber.equal(web3.utils.toWei("0"));

        });

        it("should not allow over max tx transfer", async () => {
            
            await contract.transfer(accounts[2], web3.utils.toWei("540001"));

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("540001"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            let hasError = false;
            try{
                await contract.transfer(accounts[3], web3.utils.toWei("540001"), {from: accounts[2]});
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Transfer amount exceeds the maxTxAmount.")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(true);
        });
        
    });

    describe("fees", async () => {
        
        it("should add 2.65% tokens to charity when transaction occurs", async () => {
            initialCharityBalance = await contract.balanceOf(charityMock);

            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("200"));

            finalCharityBalance = await contract.balanceOf(charityMock);
            
            expect(finalCharityBalance).to.be.bignumber.equal(initialCharityBalance.add(web3.utils.toWei(toBN("200")).mul(toBN("265")).div(toBN("10000"))));
        });

        it("should add 2.65% tokens + reflection to charity when transaction occurs if charity included in rewards", async () => {
            initialCharityBalance = await contract.balanceOf(charityMock);
            await contract.includeInReward(charityMock);
            
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});

            // calculate tokens from accounts excluded from rewards
            let tTokensToDev = web3.utils.toWei(toBN("200")).mul(toBN("75")).div(toBN("10000"));
            let tTokensToLiquidity = web3.utils.toWei(toBN("200")).mul(toBN("30")).div(toBN("10000"));
            let rTokensToDev = await getReflectionFromToken(tTokensToDev);
            let rTokensToLiquidity = await getReflectionFromToken(tTokensToLiquidity);
            let tTokensToAdjust = tTokensToDev.add(tTokensToLiquidity);
            let rTokensToAdjust = rTokensToDev.add(rTokensToLiquidity);

            tokensToCharity = web3.utils.toWei(toBN("200")).mul(toBN("265")).div(toBN("10000"));
            rTokensToCharity = await getReflectionFromToken(tokensToCharity);
            
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("200"));

            finalCharityBalance = await contract.balanceOf(charityMock);
            charityBalanceFromReflection = await getTokensFromReflection(rTokensToCharity, tTokensToAdjust, rTokensToAdjust);
            
            expect(finalCharityBalance).to.be.bignumber.equal(charityBalanceFromReflection);
        });

        it("should add 0.75% tokens to developers when transaction occurs", async () => {
            initialDevBalance = await contract.balanceOf(devMock);

            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("200"));

            finalDevBalance = await contract.balanceOf(devMock);
            
            expect(finalDevBalance).to.be.bignumber.equal(initialDevBalance.add(web3.utils.toWei(toBN("200")).mul(toBN("75")).div(toBN("10000"))));
        });

        it("should add 0.75% tokens + reflection to dev when transaction occurs if charity included in rewards", async () => {
            await contract.includeInReward(devMock);
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});

            // calculate tokens from accounts excluded from rewards
            let tTokensToCharity = web3.utils.toWei(toBN("200")).mul(toBN("265")).div(toBN("10000"));
            let tTokensToLiquidity = web3.utils.toWei(toBN("200")).mul(toBN("30")).div(toBN("10000"));
            let rTokensToCharity = await getReflectionFromToken(tTokensToCharity);
            let rTokensToLiquidity = await getReflectionFromToken(tTokensToLiquidity);
            let tTokensToAdjust = tTokensToCharity.add(tTokensToLiquidity);
            let rTokensToAdjust = rTokensToCharity.add(rTokensToLiquidity);

            tokensToDev = web3.utils.toWei(toBN("200")).mul(toBN("75")).div(toBN("10000"));
            rTokensToDev = await getReflectionFromToken(tokensToDev);
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("200"));

            finalDevBalance = await contract.balanceOf(devMock);
            devBalanceFromReflection = await getTokensFromReflection(rTokensToDev, tTokensToAdjust, rTokensToAdjust);
            
            expect(finalDevBalance).to.be.bignumber.equal(devBalanceFromReflection);
        });

        it("should add 0.3% (change fee rate) tokens to charity when transaction occurs", async () => {
            initialCharityBalance = await contract.balanceOf(charityMock);

            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});

            // set the fee perc from 1% to 15%
            await contract.setCharityFeePercent(100);

            // calculate reflection to dev
            tokensToCharity = web3.utils.toWei(toBN("100")).mul(toBN("100")).div(toBN("10000"));
            rTokensToCharity = await getReflectionFromToken(tokensToCharity);
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("100"));

            finalCharityBalance = await contract.balanceOf(charityMock);

            expect(finalCharityBalance).to.be.bignumber.equal(initialCharityBalance.add(web3.utils.toWei(toBN("100")).mul(toBN("100")).div(toBN("10000"))));
        });

        it("should allow setting less than 0.3% tax fee", async () => {
            var hasError = false;
            try {
                await contract.setTaxFeePercent(0);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting less than 0.75% dev fee", async () => {
            var hasError = false;
            try {
                await contract.setDevFeePercent(0);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting less than 0.3% liquidity wallet fee", async () => {
            var hasError = false;
            try {
                await contract.setLiquidityWalletFeePercent(0);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting less than 2.65% charity fee", async () => {
            var hasError = false;
            try {
                await contract.setCharityFeePercent(40);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting 0.3% tax fee", async () => {
            var hasError = false;
            try {
                await contract.setTaxFeePercent(30);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting 7.5% dev fee", async () => {
            var hasError = false;
            try {
                await contract.setDevFeePercent(75);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting 0.3% liquidity wallet fee", async () => {
            var hasError = false;
            try {
                await contract.setLiquidityWalletFeePercent(30);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting 2.65% charity fee", async () => {
            var hasError = false;
            try {
                await contract.setCharityFeePercent(265);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should not allow setting more than 0.3% tax fee", async () => {
            var hasError = false;
            try {
                await contract.setTaxFeePercent(31);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(true);
        });

        it("should not allow setting more than 0.75% dev fee", async () => {
            var hasError = false;
            try {
                await contract.setDevFeePercent(76);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(true);
        });

        it("should not allow setting more than 0.3% liquidity wallet fee", async () => {
            var hasError = false;
            try {
                await contract.setLiquidityWalletFeePercent(31);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(true);
        });

        it("should not allow setting more than 2.65% charity fee", async () => {
            var hasError = false;
            try {
                await contract.setCharityFeePercent(266);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(true);
        });

        it("should not allow setting negative charity fee", async () => {
            var hasError = false;
            try{
                await contract.setCharityFeePercent(-10);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("value out-of-bounds")).to.be.greaterThanOrEqual(0);
            }
            expect(hasError).to.be.equal(true);
        }); 

        it("should not allow to set exclude from fee to any address which is not the owner", async () => {
            var hasError = false;
            try{
                await contract.excludeFromFee(accounts[2], {from:accounts[2]});
            }catch(e){
                hasError = true;
            }
            
            hasAccountBeenExcluded = await contract.isExcludedFromFee(accounts[2]);
            expect(hasAccountBeenExcluded).to.be.false;
            expect(hasError).to.be.equal(true);
        });
    });
});
