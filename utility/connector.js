import { providers, ethers } from "ethers";
// import ERC20ABI from "../scripts/assets/erc20-abi.json";
// import dotenv from 'dotenv'
import WalletConnectProvider from "@walletconnect/web3-provider";

const appConnector = {

    checkForWallet : async () => {
        try {
            const { ethereum } = window;

            if (!ethereum) {
                console.log("Please install metamask!");
                return false;
            } else {
                console.log("We have the ethereum object", ethereum);
            }

            const accounts = await ethereum.request({ method: "eth_accounts" });

            if (accounts.length !== 0) {
                const account = accounts[0];
                console.log("Found an authorized account:", account);
                return account;
            } else {
                console.log("No authorized account found");
                return false;
            }
        } catch (error) {
            console.log(error);
        }
    },

    connectWallet: async () => {
        try {
            const { ethereum } = window;

            if (!ethereum) {
                // appConnector.connectWalletWithWalletConnect();
                alert("You need Metamask to use this Site, Please install MetaMask ☺️, Thank you!");
                return;
            }

            return ethereum.request({ method: "eth_requestAccounts" }).then((acc) => {
                return acc[0];
            }).then(res => {
                return appConnector.getWalletBalance( res ).then(r => {
                    return {"balance" : r, "account" : res };
                });
            });

        } catch (error) {
            console.log(error);
        }
    },

    connectWithWalletConnect : async () => {
        try {
            console.log('started here');
            const provider = new WalletConnectProvider({
                rpc: {
                1666700000: "https://api.s0.b.hmny.io",
                1666700001: "https://api.s1.b.hmny.io",
                1666700002: "https://api.s2.b.hmny.io",
                },
            });
            
            await provider.enable();

            //  Wrap with Web3Provider from ethers.js
            const web3Provider = new providers.Web3Provider(provider);
            const accounts = await web3Provider.eth.getAccounts();
            console.log(accounts);
        } catch (error) {
            console.log({error})
        }
        
    },

    getWalletBalance : async (address) =>{
                const provider = new ethers.providers.Web3Provider(ethereum);
                // // let bal = await provider.getBalance(address);
                // const signer = provider.getSigner();
                // const ONE = new ethers.Contract("0x03ff0ff224f904be3118461335064bb48df47938", ERC20ABI, provider);
                // let wallletBalance = await ONE.balanceOf(signer.address);
                // return wallletBalance;
                // // return {bal};

                let balance = await provider.getBalance(address);
                let etherString = ethers.utils.formatEther(balance);

                // let val = await provider.getBalance(address).then((balance) => {
                //     // balance is a BigNumber (in wei); format is as a sting (in ether)
                //     let etherString = ethers.utils.formatEther(balance);
                
                //     // console.log("Balance: " + etherString);
                //     return etherString;
                // });

                return etherString;
            },
};

export { appConnector };
