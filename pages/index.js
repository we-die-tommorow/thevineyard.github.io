import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'
import { ethers } from 'ethers'
import Web3Modal from 'web3modal'
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useStore from "../utility/store"
import { useEffect, useState } from "react"
import stakingpools from '../utility/stakingpools'
import ConnectModal from '../components/ConnectModal'
import { Modal } from '../components/modal'
import { useRouter } from 'next/router'
import { connectToMetaMask, connectWithWalletConnect , getContract, getReason, checkNetwork, listenForChain, getTokenContract, convertToWei, getWalletBalance, convertToEther, CONTRACT_ADDRESS } from '../utility/wallet'




  
export default function Home() {



    const [account , setAccount] = useState();
    const [modalItem , setModalItem] = useState();
    const [inputAmt, setAmount] = useState();
    const [warnAmt, setWarnAmount] = useState();
    const [pId, setpoolId] = useState();
    const [positions, setpositions] = useState();
    const [userBalance, setUserBalance] = useState();
    const [totalStaked, setTotalStaked] = useState();
    const [totalStakeHolders, setTotalStakeHolders] = useState();
    const [siteMessage, setSiteMessage] = useState();
    const [rightNet, setRightNet] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID;
    const setModal = useStore( state => state.setModalData )
    const walletAccount = useStore((state) => state.WalletAccount);
    const setDisplayModalTrue = useStore((state) => state.setDisplayModalTrue);
    const displayModal = useStore((state) => state.displayModal);
    const setWalletAccount = useStore((state) => state.setWalletAccount);
    const blurV = useStore((state) => state.blurV);
    const providerInsatnce = useStore((state) => state.providerInsatnce);
    const setProvInstance = useStore((state) => state.setProvInstance);

    // set values in the stake modal 
    const setVals = async () => {
        if(modalItem){           
            setAmount(modalItem.min_deposit);
            setpoolId(modalItem.poolId);
        }
    }

    // sets total staked on the contract 
    const getTotalstkd = async () =>{
        let contract = await getContract(providerInsatnce);
        let totalStkd = await contract.methods.getTotalStaked().call();
        let holders = await contract.methods.getTotalStakeHolderCount().call();
        setTotalStaked(await convertToEther(totalStkd));
        setTotalStakeHolders(holders);
    }

    //set user balance state
    const setBal = async () => {
        let bal = await getWalletBalance(walletAccount, providerInsatnce);
         setUserBalance(bal);
    }

    //reconnect wallet on refresh
    const reconWallet = async () =>{
        try {
            const { ethereum } = window;
            let acc;
            if (!ethereum) {
                acc = await connectWithWalletConnect();
                setWalletAccount(acc.account);
                setProvInstance(acc.prov)
                console.log(acc.prov)
            }else{
                acc = await connectToMetaMask();
                setWalletAccount(acc.account);
                setProvInstance(acc.prov)
                console.log(acc.prov)
            }
        }catch(error){
            console.log(error.message)
        } 
    }

    const listenForChange = async () => {
        let val = await listenForChain(providerInsatnce).then(res => {
            if(!res){
            //    disconnectWallet();
            }
            console.log( res );
        });
        
    }



    useEffect(()=>{
        if(walletAccount){
           
            if (!checkNetwork(providerInsatnce, true)) {
                setWalletAccount('')
                console.log('doesnt remv')
                setProvInstance('')
                localStorage.removeItem('walletConnected')
                toast.error(`WRONG NETWORK! Please switch to ${ process.env.NEXT_PUBLIC_NETWORK_NAME}`)
                console.log(siteMessage);
            }else{
                setRightNet(true)
            }
        }  
    },[]) //set as 1



    useEffect(()=>{ 
        
        if(walletAccount){
           
            if (!checkNetwork(providerInsatnce, false)) {
                setRightNet(false);
            }else{
                setRightNet(true)
            }
        }
    }) //set continous

    useEffect( ()=>{ 
        setVals();
        getTotalstkd();
        if(walletAccount && rightNet){
            getPositions();               
            setBal();   
            
        }
        if(!walletAccount){
            (async () => {
                if(localStorage.getItem('walletConnected')) await reconWallet();
            })()
        }
    }) //set continous

    // stake tokens 
    const stake = async ( ) => {
        
        let amount = document.getElementById("amtInput").value;

        if (!walletAccount) {
            toast.info(`Please connect wallet`)
            return;
        }

        if(+amount < +inputAmt){
            toast.info(`Input Min of ${inputAmt}`)
            return;
        }
      
        if (+amount > +userBalance) {
            toast.error(`You don't have enough tokens for this transaction`);
            return;
        }

        amount = await convertToWei(amount);
        let contract = await getContract(providerInsatnce);
        let token = await getTokenContract(providerInsatnce);

        try {
            setLoading(true);

            let approve = await token.methods.approve( CONTRACT_ADDRESS, amount ).send({from: walletAccount}).then( async res => {
                    if(res){
                        let stake = await contract.methods.stake( amount, pId  ).send({from: walletAccount,  gasLimit: 300000});
                    }
                });

            setLoading(false);
            toast.success(`Staking Successful`);
            getPositions();

        } catch (error) {
            let state = await contract.methods.getPoolState(pId).call({from: walletAccount});
            console.log({state})
            if (await state) {
                toast.error('Staking in this pool is currently Paused. Please contact admin');
            }else{
               toast.error('You currently have a stake in this pool. You have to Unstake.');
            }

            setLoading(false);

        }
    }

    //claim reward from contract
    const claim_reward = async (ppid) => {
        let resCl = confirm('Are you sure you want to claim Now?');
        if(!resCl){
            toast.info('Claiming request cancelled'); 
            return;
        }
        console.log({ppid});
        let contract = await getContract(providerInsatnce);
        try {
            setLoading(true)
            let claimreward = await contract.methods.claimReward( ppid ).send({from: walletAccount,  gasLimit: 300000}).then(r =>{
                toast.success(`Claiming Successful`);
                setLoading(false)
            });
            setLoading(false)
        } catch (error) {
            console.log(error)
        }
    }

    // format timestamp into readable text e.g "24 July 2021"
    function formatDate(timestamp, days=null) {
        let monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        let dateObj = new Date(timestamp * 1000);
        if (days == null) {
            let month = monthNames[dateObj.getMonth()];
            let year = dateObj.getFullYear();
            let date =  dateObj.getDate();
            let hours =  dateObj.getHours();
            let minutes =  dateObj.getMinutes();
            return `${date} ${month} ${year} ${hours}:${minutes}`;
        }
        dateObj.setDate(dateObj.getDate() + days);
        let month = monthNames[dateObj.getMonth()];
        let year = dateObj.getFullYear();
        let date =  dateObj.getDate();
        let hours =  dateObj.getHours();
        let minutes =  dateObj.getMinutes();
        return `${date} ${month} ${year} ${hours}:${minutes}`;
    }
  
    //get user's staked pools from contract
    const getPositions = async () => {
        let contract = await getContract(providerInsatnce);
        let i;
        let newArr = [];
        
        for (let i = 0; i < stakingpools.length; i++) {
            try {
                 let stakingBalance = await contract.methods.getUserStakingBalance(+stakingpools[i].poolId, walletAccount).call();
                if(stakingBalance > 0) {
                    stakingpools[i].bal = ethers.utils.formatEther(stakingBalance);
                    let reward_bal = await contract.methods.calculateUserRewards(walletAccount, stakingpools[i].poolId).call();
                    let stakeTime = await contract.methods.getLastStakeDate( stakingpools[i].poolId,walletAccount).call();
                    stakeTime = stakeTime.toString();
                    let startDate = formatDate(+stakeTime);
                    let endDate =  formatDate(+stakeTime, +stakingpools[i].duration);
                    stakingpools[i].date = startDate + " - " + endDate;
                    stakingpools[i].end_date = endDate;
                    stakingpools[i].reward_bal = await convertToEther(reward_bal);
                    newArr.push(stakingpools[i])
                }
            } catch (err) {
    
            }
        }
        setpositions(newArr)
    }

    //display connect modal to connect wallet
    const connectWall = async () =>{
        setDisplayModalTrue();
        console.log('entss')
    }

   
    //disconnect wallet and reload page
    const disconnectWallet = async () =>{
        setWalletAccount('')
        setProvInstance('')
        localStorage.removeItem("WEB3_CONNECT_CACHED_PROVIDER");
        localStorage.removeItem('walletConnected')
        localStorage.removeItem('walletconnect');
        router.reload(window.location.pathname)
    }

    // handle onchange allow only numbers to be typed into input field 
    const onChange = event => {
        event.target.value = event.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
        setWarnAmount(+event.target.value);
    };

    const setModalPillActive = ()=>{
        document.getElementById('pills-home').classList.remove("active");
        document.getElementById('pills-home').classList.remove("show");
        document.getElementById('pills-contact').classList.add("active");
        document.getElementById('pills-contact').classList.add("show");
        document.getElementById('pills-home-tab').classList.remove("active");
        document.getElementById('pills-contact-tab').classList.add("active");
        
    }
    

  return (<> 
  
      <header>
     
      <ToastContainer />
      <ConnectModal showModal={displayModal} />
      {!siteMessage? "" : (<div className='d-flex justify-contents-center align-items-center' style={{display: "flex", background: "orange", padding: "20px"}}><b>{siteMessage}</b></div>)}
          <nav className="navbar navbar-expand-lg  navbar-dark">
              <a  className="navbar-brand" href="#">
                  <div>
                      <span className="logotext" >
                          <img height={'auto'}  src="/img/" alt="" /> 
                      </span>  
                  </div>
  
                 
                
              </a>
              <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span className="navbar-toggler-icon"></span>
              </button>
              <div className="collapse navbar-collapse" id="navbarNav">
                <ul className="navbar-nav">
                  <li className="nav-item active">
                    <a className="nav-link" href="#">Stake </a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" href="#">Whitepaper</a>
                  </li>
                  <li className="nav-item">
                   <a className="nav-link" href="#">Roadmap</a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link disabled" href="#">Buy TVY</a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link disabled" href="#">NftMarketPlace</a>
                  </li>
                </ul>
                  
                  <button className="mr-sm-2 mr-lg-0 mr-md-0 connectWallet" onClick={()=>{ !walletAccount ? connectWall() : disconnectWallet()}}>
                     { !walletAccount ? `Connect Wallet` : walletAccount.substring(0, 7)}
                  </button>
                   
              </div>
  
            </nav>
      </header>
      <main className="container" style={blurV?{
        filter: "blur(8px)"        
      }: {}}>
  
          <section>
              <div className="text-white" style={{marginBottom: "64px"}}>
                  <h1>The VineYard</h1>
                  <p className="text-grey">Stake TVY and Earn Rewards Daily</p>
              </div>
  
              <div className="info-wrapper">
                  <div className="portfolio_value d-flex flex-wrap  flex-wrap  flex-wrap  justify-content-between">
                      <span className="value_wrapper d-flex flex-wrap  flex-wrap  flex-wrap  align-items-center">
                          <span className="p_value_label">Portfolio Value : &nbsp;</span>
                          <span className="p_value"> {!walletAccount? 0 :(!userBalance?(
                            <div className="spinner-grow" role="status">
                            </div>
                          ):userBalance)} TVY</span>
                      </span>
  
                      <button className="btn buy-coin-btn text-white">
                          Buy TVY
                      </button>
                  </div>
              </div>
  
              <div className=" container other-tokens d-flex flex-wrap  flex-wrap  flex-wrap ">
                  <span className="token d-flex flex-wrap  flex-wrap  flex-wrap  flex-column">
                      <span className="tokenName d-flex flex-wrap  flex-wrap  flex-wrap  flex-row align-items-center justify-content-between">
                          <span className="eclipse" id="eclipse_green"></span>
                          <span> Total Stakes </span> 
                      </span>
  
                      <span className="tokenValue">{ !totalStakeHolders? (
                            <div className="spinner-grow" role="status">
                            </div>
                          ): totalStakeHolders * 1
                      
                      }  
                    
                          
                          
                      </span>
  
                  </span>
  
                  <span className="token d-flex flex-wrap  flex-wrap  flex-wrap  flex-column">
                      <span className="tokenName d-flex flex-wrap  flex-wrap  flex-wrap  flex-row align-items-center justify-content-between">
                          <span className="eclipse" id="eclipse_green"></span>
                          <span>Total TVY Staked </span> 
                      </span>
                      <span className="tokenValue">
                      {!totalStaked?(
                            <div className="spinner-grow" role="status">
                            </div>
                          ): totalStaked * 1}
                      </span>
                  </span>
  
              </div>
  
              <div className="container progress-container">
                  <div className="progress">
                      <div className="progress-bar" role="progressbar" style={{width: "53%" ,background:"grey"}} aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>
                      <div className="progress-bar" role="progressbar" style={{width: "15%", background:  "grey"}} aria-valuenow="30" aria-valuemin="0" aria-valuemax="100"></div>
                      <div className="progress-bar" role="progressbar" style={{width: "25%" ,background: "grey",}} aria-valuenow="20" aria-valuemin="0" aria-valuemax="100"></div>
                      <div className="progress-bar" role="progressbar" style={{width: "7%", background: "grey"}} aria-valuenow="20" aria-valuemin="0" aria-valuemax="100"></div>
                  </div>
  
                  <p style={{color: "#AFBED0", marginBottom: "16px"}}>Your Current Positions</p>
                  { !positions || positions?.length == 0 ?(<p style={{color: "#fff"}}> You currently have no stake in any pool </p>) : "" }
                    { !positions ? "" : (

                       positions.map((item, index) => {
                        return (
                        <div key={`claim-${index}`} className="claim-reward position-wrapper d-flex flex-wrap  flex-wrap  flex-wrap  justify-content-between">
                                            
                            <div key={`it-${index}`} className="d-flex flex-wrap  flex-wrap  flex-wrap  flex-column">
                                <span className="d-flex flex-wrap  flex-wrap  flex-wrap  align-items-center" style={{height: "38px"}}>
                                    <span className="">
                                        <img  height={'auto'} src={item?.image} alt="" />
                                    </span>
                                    <span className="text-white" style={{fontWeight: "700",
                                    fontSize: "1.5rem",
                                    margin: "0 10px"
                                    }}>
                                        {item?.name}
                                    </span>
                                    <span>
                                        <img  height={'auto'} src="/img/open.png" alt="" />
                                    </span> 
                                </span>
                                <p className="text-light-grey"> Duration:{" "} {item?.date}</p>
                            </div>

                            <div key={`rti-${index}`} className="d-flex flex-wrap  flex-wrap  flex-wrap  flex-column">
                                <span className="text-light-grey"> Return on Investment</span>
                                <span style={{color: "rgba(81, 235, 180, 1)",
                                fontWeight: "700",
                                fontSize: "1.5rem"}}> {item?.roi}</span>
                            </div>

                            <div key={`yr-${index}`} className="d-flex flex-wrap  flex-wrap  flex-wrap  flex-column">
                                <span className="text-light-grey"> Your Stake</span>
                                <span>
                                    <span className="text-white" style={{
                                    fontWeight: "700",
                                    fontSize: "1.5rem"}}>{item?.bal * 1} The VineYard</span>
                                    <span className="text-light-grey"></span>
                                </span>
                            </div>

                            <div className="d-flex flex-wrap  flex-wrap  flex-wrap  flex-column">
                                <button key={`btncl-${index}`} className=" claim-reward-btn text-white " data-bs-toggle="modal" data-bs-target="#exampleModal" onClick={()=>{setModalItem(item); setModalPillActive(); console.log({item})}} >
                                    {!loading? 'Claim reward': 'Processing...'}
                                </button>
                            </div>

                        </div>

                        )
                       } )
                    )}

              </div>
              
          </section>
  
          <section className="staking-pool">
              <h2 className="text-white staking-pool-heading" >
                  The VineYard Staking Pool
              </h2>
  
              <div className="staking-pool-table-wrapper table-responsive">
                  <table className="table text-white">
                      <thead style={{border: "0"}}>
                        <tr className="text-grey">
                          <th scope="col">Staking</th>
                          <th scope="col">Epoch</th>
                          <th scope="col">APR</th>
                          <th scope="col">Min Stake</th>
                          <th scope="col">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                          {
                            stakingpools.map((pool, index)  => {
                            return(

                        <tr key={index}>
                          <td>
                              <span className="d-flex flex-wrap  flex-wrap  flex-wrap  align-items-center ">
                                  <span style={{marginRight: "16px"}}><img height={'auto'}  src={pool?.image} alt="" /> </span>
                                  <span>{pool?.name}</span>
                              </span>
                          </td>
                          <td> 
                              <span>{pool?.duration} Epoch</span> 
                          </td>
                          <td>
                              <span>{pool?.roi}</span>
                          </td>
                          <td>
                              <span>{pool?.min_deposit} TVY</span>
                          </td>
                          <td>
                              
                              <button className="stake-btn" data-bs-toggle="modal" data-bs-target="#exampleModal" onClick={()=>{setModalItem(pool); console.log({pool})}} > Stake </button>
                             
                          </td>
                        </tr>
                        
  
                            )
                        })
                          }
                        
                       
                      </tbody>
                    </table>
              </div>
          </section>
        {/* MODAL SECTION  */}


        <div className="modal fade" id="exampleModal" tabIndex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
              <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                  <div className="modal-header">
                  <h5 className="modal-title" id="exampleModalCenterTitle">Stake TVY</h5>
                  <button type="button" className="btn-close btn-close-white" style={{fontSize: "1.3rem"}} data-bs-dismiss="modal" aria-label="Close">
                      <span aria-hidden="true"> 
                      {/* <img height={'auto'} src="/img/ex.svg" alt="" /> */}
                      </span>
                  </button>
                  </div>
                  <div className="modal-body">
                      <ul className="nav nav-pills" id="pills-tab" role="tablist">
                          <li className="nav-item">
                            <a className="nav-link active" id="pills-home-tab" data-bs-toggle="pill" data-bs-target="#pills-home"  role="tab" aria-controls="pills-home" aria-selected="true">Staking</a>
                          </li>
                          {/* <li className="nav-item">
                            <a className="nav-link" id="pills-profile-tab" data-toggle="pill" href="#pills-profile" role="tab" aria-controls="pills-profile" aria-selected="false">Withdrawal</a>
                          </li> */}
                          <li className="nav-item">
                            <a className="nav-link" id="pills-contact-tab" data-bs-toggle="pill" data-bs-target="#pills-contact" role="tab" aria-controls="pills-contact" aria-selected="false">TVY Rewards</a>
                          </li>
                        </ul>
                        <div className="tab-content" id="pills-tabContent">
                          <div className="tab-pane fade show active" id="pills-home" role="tabpanel" aria-labelledby="pills-home-tab">
                              
                              <div className="d-flex flex-wrap  flex-wrap  flex-wrap  justify-content-between text-grey" style={{marginBottom: "10px"}}>
                                  <span>
                                      Amount
                                  </span>
                                  <span>
                                      TVY staked balance: <span style={{fontWeight:"500"}}>{!userBalance?"0":userBalance}</span>
                                  </span>
                              </div>
  
                              <div className="d-flex justify-content-between align-items-center" style={{
                              background: "#0E1725",
                              borderRadius: "8px",
                              padding: "0 28.5px",
                              fontWeight: "700",
                              fontSize: "1.5rem",
                              marginBottom: "32px"
                              }}>
                                  
                                  <input type="text" id="amtInput" placeholder={`Min ${inputAmt}`} onChange={onChange} style={{
                                    background: "#0E1725",
                                    borderRadius: "8px",
                                    padding: "28.5px",
                                    fontWeight: "700",
                                    fontSize: "1.3rem",
                                    border: "none",
                                    width: "100%",
                                    outline: "none",
                                    color: "#FFF"
                                  }} />
                                  <span >TVY</span>
                              </div>
  
                              <div className="staking-category d-flec flex-column" style={{padding: "20px", background: "#0E1725", borderRadius: "9.75964px", marginBottom: "32px"}}>
                                  <span className="d-flex flex-wrap  flex-wrap  flex-wrap  justify-content-between" style={{marginBottom:"18px"}}>
                                      <span>Staking Category</span>
                                      <span>{modalItem?.name}</span>
                                  </span>
  
                                  <span className="d-flex flex-wrap  flex-wrap  justify-content-between" style={{marginBottom:"18px"}}>
                                      <span>Duration 
                                          <span> 
                                              <img   height="20px" src="/img/info.png" alt="" />
                                          </span>
                                      </span>
                                      <span>{modalItem?.duration} Days</span>
                                  </span>
                                  <span className="d-flex flex-wrap  flex-wrap  justify-content-between" style={{marginBottom:"18px"}}>
                                      <span>APY</span>
                                      <span>{modalItem?.roi} <span style={{color:"rgba(171, 146, 252, 1)"}}>  </span> <span>
                                          
                                      </span> </span>
                                  </span>
                              </div>
  
                              <div className="notice d-flex flex-wrap  flex-wrap " style={{background: "#0E1725", borderRadius: "8px" ,marginBottom: "32px", padding: "18px 33px"}}>
                                  <div className="img d-flex flex-wrap  flex-wrap  justify-content-center align-items-center" style={{position: "relative", marginRight: "25px"}}>
                                      <img height={'auto'}   style={{position: "absolute"}} src="/img/exclaim.png" alt="" />
                                      <img height={'auto'}  src="/img/shield.png" alt="" />
  
                                  </div>
                                  <div className="d-flex flex-wrap  flex-wrap  flex-column">
                                      <span style={{fontWeight: "700", fontSize: "1.1rem"}}>Staking {!warnAmt?0:warnAmt} TVY {!modalItem?.duration? 0: modalItem?.duration} Days</span>
                                      <span style={{color:"#AFBED0", fontWeight: "400"}}>Staked TVY Cannot be Unstaked</span>
                                  </div>
                              </div>
                              <div className="d-flex flex-wrap  flex-wrap ">
                                  <button className="btn flex-grow-1 stake-btn" style={{fontWeight: "800", fontSize: "24px"}} onClick={()=>{
                                    stake();
                                  }}>
                                     {!loading? 'Stake': 'Processing...'} 
                                  </button>
                              </div>
                              
  
                          </div>
                          <div className="tab-pane fade" id="pills-contact" role="tabpanel" aria-labelledby="pills-contact-tab">
  
                              <p style={{color: "rgba(175, 190, 208, 1)"}}>Your Positions</p> 
                              
                            {!positions || positions?.length == 0 ? (<p> You currently have no stake in any pool </p>) : "" }
                            
                            { positions?.filter( item => {
                                if(item?.poolId == modalItem?.poolId){
                                    return item;
                                }
                            }).map((val, index) => {
                                return (<>
                                    <div key={`item`+index} className="position-wrapper d-flex flex-wrap  flex-wrap  justify-content-between" style={{background: "#0E1725"
                                    ,borderRadius: "8px", marginBottom: "32px", padding: "28px"}}>
                                        
                                        <div className="d-flex flex-wrap  flex-wrap  flex-column">
                                            <span className="d-flex flex-wrap  flex-wrap  align-items-center">
                                                <span className="">
                                                    <img height={'auto'}  src="/img/spaceship.png" alt="" />
                                                </span>
                                                <span className="text-white" style={{fontWeight: "700",
                                                fontSize: "24px", margin: "0 10px"}}>
                                                    {val?.name}
                                                </span>
                                                <span>
                                                    <img height={'auto'}  src={val?.image} alt="" />
                                                </span> 
                                            </span>
                                            <p className="text-light-grey" style={{fontWeight: "400"}}>Duration: {" "} {val?.date}</p>
                                        </div>
                    
        
                                        <div className="d-flex flex-wrap  flex-wrap  flex-column" >
                                            <span className="text-light-grey"> Your Stake</span>
                                            <span> 
                                                <span className="text-white" style={{fonWeight: "700",
                                                fontSize: "1.5rem"}}>{val?.bal*1} TVY</span>
                                            </span>
                                        </div>
                    
                    
                                  </div>
                           

  
                              <p key={`position`+index} style={{color: "rgba(175, 190, 208, 1)"}}>Your Rewards</p>
  
                              <div key={`bal`+index} className="d-flex flex-wrap  flex-wrap  flex-wrap " style={{marginBottom: "32px", fontWeight: "700",
                              fontSize: "36px", background: "#0E1725", borderRadius: "8px", padding: "28px"}}>
                                <img src='/img/logo.png' />
                                  <span className="text-white" style={{marginLeft: "16px"}}>{val?.reward_bal * 1} TVY</span>
                              </div>
    
                              <div key={`warn`+index} className="notice d-flex " style={{background: "#0E1725", borderRadius: "8px" ,marginBottom: "32px", padding: "18px 33px"}}>
                                  <div className="img d-flex flex-wrap  flex-wrap  justify-content-center align-items-center" style={{position: "relative", marginRight: "25px"}}>
                                      <img height={'auto'}   style={{position: "absolute"}} src="/img/exclaim.png" alt="" />
                                      <img height={'auto'}  src="/img/shield.png" alt="" />
  
                                  </div>
                                  <div className="d-flex flex-wrap  flex-wrap  flex-column">
                                      <span style={{fontWeight: "700", fontSize: "1.1rem"}}>Due date to claim rewards is {val?.end_date}</span>
                                      <span style={{color:"#AFBED0", fontWeight: "400"}}>Premature withdrawal will make you lose all rewards in this pool, and 20% of your staked tokens</span>
                                  </div>
                              </div>

                              <div key={`claim`+index} className="d-flex flex-wrap  flex-wrap  flex-wrap ">
                                  <button className="btn flex-grow-1 stake-btn" style={{fontWeight: "800", fontSize: "24px"}} onClick={()=>{claim_reward(pId)}}>
                                      {!loading? 'Claim reward': 'Processing...'}
                                  </button>
                              </div>
                            </>)
                            }) }
                            
                          </div>
                        </div>
                        
                  </div>
              </div>
              </div>
          </div>
    
      </main>
  </>)
}
