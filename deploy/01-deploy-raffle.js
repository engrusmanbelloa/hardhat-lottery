const {
    network,
    run,
    getnamedAccounts,
    deployments,
    ethers
} = require("hardhat")
const {
    networkConfig,
    developmentChains,
} = require("../helper-hardhat-config")

const {
    verify
} = require("../utils/verify")

// const VRF_SUB_AMOUNT = ethers.utils.parseEther("10")
const FUND_AMOUNT = "1000000000000000000000"

module.exports = async function ({
    getNamedAccounts,
    deployments
}) {
    const {
        deploy,
        log
    } = deployments
    const {
        deployer
    } = await getNamedAccounts()
    const chainId = network.config.chainId
    let VRFCoordinatorV2Address, subscriptionId

    if (developmentChains.includes(network.name)) {
        const VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        VRFCoordinatorV2Address = VRFCoordinatorV2Mock.address
        const transactionResponse = await VRFCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = transactionReceipt.events[0].args.subId
        // fund the subscription
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_AMOUNT)
    } else {
        subscriptionId = networkConfig[chainId]["subscriptionId"]
        VRFCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]
    const args = [VRFCoordinatorV2Address, entranceFee, gasLane, subscriptionId, interval, callbackGasLimit]

    const loterry = await deploy("Loterry", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("verifying...")
        await verify(loterry.address, args)
    }
    log("---------------------------------")
}

module.exports.tags = ["all", "lottery"]