Bitcoin Analysis
-

This repository contains the work I'm doing to complete my thesis: **Performance analysis of the Bitcoin protocol**.

### Project description
> Bitcoin as a decentralized global currency gain its reputation and strength from the data structure working in its core: the blockchain. This technology offers a lot of advantages such as decentralization and transparency but has also some issues and one of those is about scalability. In fact, at the moment two parameters, respectively block size and block interval are capping the rate at which transactions are processed, and changing either one of the two leads to no improvements.
The idea about this project is create an in-house bitcoin protocol in order to benchmark and analyze its performance, keeping an eye on tradeoffs and possible improvements.

### Project Goal
> Understanding the codebase of the bitcoin protocol in order to adjust it to run in a controlled and private environment.
This will give us the possibility to collect some meaningful data, changing the default parameters of the protocol as well as the environment conditions and workload characteristics.
We will also be able to experiment with some real bitcoin trace, to be able to collect more realist data. In the end, data will be analyzed into a report consisting of issues, tradeoffs and possible improvements.

### Motivation
> Bitcoin and blockchain are an emergent and wildly used technology with a different view in several aspects compared to other more traditional payment systems.
Unfortunately, at the moment it can’t be used a replacement for those due to some issues related to the scalability of the protocol. So, in order to have a better understanding of this problems we are going to collect and analyze some data in order to comprehend where the system bottlenecks are.

### Instruction
> Follow the instruction to run testing:
1. Download Bitcoin (https://bitcoin.org/it/scarica).
2. Install Bitcoin core and change the executable name to bitcoinoriginal.
3. Sync the blockchain with txindex = 1.
4. Download and build a second instance of bitcoin from this url https://github.com/Fraccaman/bitcoin from 'setmaxblocksize' branch.
5. Replace the generated bitcoind program in the executable folder.
6. Download this repository and change branch to feature/framework.
7. Run ```nodegenerator.js``` (--help to get the neccessary parameters)
8. Download tcconfig (https://github.com/thombashi/tcconfig)
9. If you want to insert latencies run ```./src/commandandcontrol.js latency > json.json``` and then ```./src/commandandcontrol.js test```
8. Run ```resetter.py```. You need to provide a path to a folder containing a valid main chain.
9. Run ```commandandcontrol.js``` (--help to get the necessary paramters) to run the tests.
10. Data are saved in a sqlite database.

It's possibile to modify latencies, hash power and geographial distribution by modifing latencies.conf, nodes.conf and nodesDistribution.conf.
