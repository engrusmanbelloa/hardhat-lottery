const {
    developmentChains
} = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25") // 0.25 is the premium version. it cost 0.25 link.
const GAS_PRICE_LINK = 1e9 // calculated value based on the gas price of the chain.

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
    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (developmentChains.includes(network.name)) {
        console.log("local network detected! deploying mocks...")
        // deploy vrfcoordinator
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
        })
        log("Mocks deployed!")
        log("----------------------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]