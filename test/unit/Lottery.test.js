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

    !developmentChains.includes(network.name) ? describe.skip : describe("Raffle unit test", async function () {
        let lottery, VRFCoordinatorV2Mock, lotteryEntranceFee, deployer, interval
        const chainId = network.config.chainId

        beforeEach(async function () {

            deployer = (await getNamedAccounts()).deployer
            // accounts = await ethers.getSigners() // could also do with getNamedAccounts
            // deployer = accounts[0]
            // player = accounts[1]
            await deployments.fixture("all")
            lottery = await ethers.getContract("Loterry", deployer)
            VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            lotteryEntranceFee = await lottery.getEntranceFee()
            interval = await lottery.getInterval()
        })

        describe("constructor", () => {
            it("initializes the lottery correctly", async () => {
                const lotteryState = await lottery.getLotteryState()
                // const interval = await lottery.getInterval()
                assert.equal(lotteryState.toString(), "0")
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])
            })
        })

        describe("enterLottery", async () => {
            it("reverts when you dont pay enough", async () => {
                await expect(lottery.enterLottery()).to.be.revertedWith(
                    "Loterry__NotEnoughETHEntered"
                )
            })

            it("records players when they enterLottery", async () => {
                await lottery.enterLottery({
                    value: lotteryEntranceFee
                })
                const playerFromContract = await lottery.getPlayer(0)
                assert.equal(playerFromContract, deployer)
            })
            it("emits events on enter", async () => {
                await expect(lottery.enterLottery({
                    value: lotteryEntranceFee
                })).to.emit(
                    lottery, "LoterryEnter"
                )
            })
            it("doesn't allow entrance when lottery is calculating", async () => {
                await lottery.enterLottery({
                    value: lotteryEntranceFee
                })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                // pretend to be chaonlink keeper
                await lottery.performUpkeep([])
                await expect(lottery.enterLottery({
                    value: lotteryEntranceFee
                })).to.be.revertedWith("Loterry__NotOpen")
            })
        })
        describe("checkUpkeep", async () => {
            it("returns false if people havent sent any eth", async () => {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                const {
                    upkeepNeeded
                } = await lottery.checkUpkeep([])
                assert(!upkeepNeeded)
            })
            it("returns false if lottery is not open", async () => {
                await lottery.enterLottery({
                    value: lotteryEntranceFee
                })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                await lottery.performUpkeep([])
                const lotteryState = await lottery.getLotteryState()
                const {
                    upkeepNeeded
                } = await lottery.callStatic.checkUpkeep([])
                assert.equal(lotteryState.toString(), "1")
                assert.equal(upkeepNeeded, false)
            })
            it("returns false if enough time hasn't passed", async () => {
                await lottery.enterLottery({
                    value: lotteryEntranceFee
                })
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
                await network.provider.request({
                    method: "evm_mine",
                    params: []
                })
                const {
                    upkeepNeeded
                } = await lottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(!upkeepNeeded)
            })
            it("returns true if enough time has passed, has players, eth, and is open", async () => {
                await lottery.enterLottery({
                    value: lotteryEntranceFee
                })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({
                    method: "evm_mine",
                    params: []
                })
                const {
                    upkeepNeeded
                } = await lottery.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(upkeepNeeded)
            })
        })
        describe("performUpkeep", () => {
            it("it can only run if checkupkeep is true", async () => {
                await lottery.enterLottery({
                    value: lotteryEntranceFee
                })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                const tx = await lottery.performUpkeep([])
                assert(tx)
            })
            it("reverts when checkUpkeep is false", async () => {
                await expect(lottery.performUpkeep([])).to.be.revertedWith(
                    "Loterry__UPkeepNeeded"
                )
            })
            it("updates when lottery state, emits a requestid", async () => {
                // Too many asserts in this test!
                await lottery.enterLottery({
                    value: lotteryEntranceFee
                })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({
                    method: "evm_mine",
                    params: []
                })
                const txResponse = await lottery.performUpkeep([])
                const txReciept = await txResponse.wait(1)
                const requestid = await txReciept.events[1].args.requestId
                const lotteryState = await lottery.getLotteryState()
                assert(requestid.toNumber() > 0)
                assert(lotteryState.toString() == "1")
            })
        })
        describe("fulfilRandomWords", () => {
            beforeEach(async () => {
                await lottery.enterLottery({
                    value: lotteryEntranceFee
                })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
            })
            it("can only be called after performUpkeep is called", async () => {
                await expect(VRFCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)).to.be.revertedWith("nonexistent request")
                await expect(VRFCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)).to.be.revertedWith("nonexistent request")
            })
            it("picks winner, resets the lottory, and sends money", async () => {
                const additionalEntrants = 3
                const startingAccountIndex = 2 // deployer = 0
                const accounts = await ethers.getSigners()
                for (let i = startingAccountIndex; i < additionalEntrants + startingAccountIndex; i++) {
                    const accountConnectedLottery = lottery.connect(accounts[i])
                    await accountConnectedLottery.enterLottery({
                        value: lotteryEntranceFee
                    })
                }
                const startingTimeStamp = await lottery.getLastTimeStamp()

                // performUpkeep (mockbeing chainlink keepers)
                // fulfillRandomWords (mockbeing chainlink vrf)
                await new Promise((resolve, reject) => {
                    lottery.once("winnerPicked", async () => {
                        console.log("Foud the event")
                        try {
                            const recentWinner = await lottery.getRecentWinner()
                            const lotteryState = await lottery.getLotteryState()
                            const endingTimeStamp = await lottery.getLastTimeStamp()
                            const numPlayers = await lottery.getNumberOfPlayers()
                            const winnerEndingBalance = await accounts[1].getBalance()
                            console.log(recentWinner)
                            console.log(accounts[3].address)
                            console.log(accounts[2].address)
                            console.log(accounts[1].address)
                            console.log(accounts[0].address)
                            assert.equal(numPlayers.toString(), "0")
                            assert.equal(lotteryState.toString(), "0")
                            assert(endingTimeStamp > startingTimeStamp)

                            assert.equal(winnerEndingBalance.toString(),
                                winnerStartingBalance.add(lotteryEntranceFee.mul(additionalEntrants).add(lotteryEntranceFee).toString()))
                        } catch (e) {
                            reject(e)
                        }
                        resolve()
                    })
                })
                // setting up the listener
                // below, we will fire the event, and the listener will pick it up and resolve
                const tx = await lottery.performUpkeep([])
                const txReciept = await tx.wait(1)
                const winnerStartingBalance = await accounts[1].getBalance()
                await VRFCoordinatorV2Mock.fulfillRandomWords(
                    txReciept.events[1].args.requestId, lottery.address
                )
            })
        })
    })