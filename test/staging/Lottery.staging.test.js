const {
    developmentChains,
    networkConfig
} = require("../../helper-hardhat-config")

const {
    getNamedAccounts,
    deployments,
    ethers,
    network
} = require("hardhat")

const {
    assert,
    expect
} = require("chai")
const {
    int
} = require("hardhat/internal/core/params/argumentTypes")

developmentChains.includes(network.name) ? describe.skip :
    describe("Raffle unit test", async function () {
        let lottery, lotteryEntranceFee, deployer

        beforeEach(async function () {

            deployer = (await getNamedAccounts()).deployer
            // accounts = await ethers.getSigners() // could also do with getNamedAccounts
            // deployer = accounts[0]
            // player = accounts[1]
            lottery = await ethers.getContract("Loterry", deployer)
            lotteryEntranceFee = await lottery.getEntranceFee()
        })

        describe("fulfilRandomWords", () => {
            it("works with live chainlink keepers, vrf, we get random winner", async () => {
                // enter lottery
                const startingTimeStamp = await lottery.getLastTimeStamp()
                const accounts = await ethers.getSigners()
                await new Promise(async (resolve, reject) => {
                    lottery.once("winnerPicked", async (winner) => {
                        console.log("winnerPicked event fired")
                        try {
                            // add asserts here
                            const recentWinner = await lottery.getRecentWinner()
                            const lotteryState = await lottery.getLotteryState()
                            const winnerBalance = await accounts[0].getBalance()
                            const endingTimeStamp = await lottery.getLastTimeStamp()

                            await expect(lottery.getPlayer(0)).to.be.reverted
                            assert.equal(recentWinner.toString(), accounts.address)
                            assert.equal(lotteryState, 0)
                            assert.equal(winnerEndingBalance.toString(), winnerStartingBalance.add(lotteryEntranceFee).toString())
                            assert(endingTimeStamp > startingTimeStamp)
                            resolve()
                        } catch (e) {
                            console.log(e)
                            reject(e)
                        }
                    })
                    // enter lottery 
                    await lottery.enterLottery({
                        value: lotteryEntranceFee
                    })
                    const winnerStartingBalance = await accounts[0].getBalance()
                })
            })
        })
    })