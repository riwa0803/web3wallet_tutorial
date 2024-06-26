import "@walletconnect/react-native-compat";
import "@ethersproject/shims";

import { Core } from "@walletconnect/core";
import { ICore } from "@walletconnect/types";
import { Web3Wallet, IWeb3Wallet } from "@walletconnect/web3wallet";
import { Alert } from "react-native";

export let web3wallet: IWeb3Wallet;
export let core: ICore;
export let currentETHAddress: string;

import { useState, useCallback, useEffect } from "react";
import { createOrRestoreEIP155Wallet } from "./EIP155Wallet";

async function createWeb3Wallet() {
  // Here we create / restore an EIP155 wallet
  const { eip155Addresses } = await createOrRestoreEIP155Wallet();
  currentETHAddress = eip155Addresses[0];
  console.log("Current ETH Address:", currentETHAddress);
  Alert.alert('ETH Address', `Current ETH Address: ${currentETHAddress}`);

  // HardCoding it here for ease of tutorial
  // Paste your project ID here
  const ENV_PROJECT_ID = "584495c68516f78a2aa4e225307b4f07";
  const core = new Core({
    projectId: ENV_PROJECT_ID,
  });

  // Edit the metadata to your preference
  web3wallet = await Web3Wallet.init({
    core,
    metadata: {
      name: "Web3Wallet React Native Tutorial",
      description: "ReactNative Web3Wallet",
      url: 'web3wallettutorial://',
      icons: ["https://avatars.githubusercontent.com/u/37784886"],
      redirect: {
        native: 'web3wallettutorial://',
      },
    },
  });

  console.log("Web3Wallet initialized");
  Alert.alert('Web3Wallet', 'Web3Wallet initialized');
}

// Initialize the Web3Wallet
export default function useInitialization() {
  const [initialized, setInitialized] = useState(false);

  const onInitialize = useCallback(async () => {
    try {
      await createWeb3Wallet();
      setInitialized(true);
      console.log("Initialization completed");
      Alert.alert('Initialization', 'Initialization completed');
    } catch (err: unknown) {
      console.log("Error for initializing", err);
      Alert.alert('Initialization Error', `Error for initializing: ${err}`);
    }
  }, []);

  useEffect(() => {
    if (!initialized) {
      console.log("Starting initialization");
      Alert.alert('Initialization', 'Starting initialization');
      onInitialize();
    }
  }, [initialized, onInitialize]);

  console.log("Initialized Web3Wallet");
  return initialized;
}

export async function web3WalletPair(params: { uri: string }) {
  console.log("Pairing with URI:", params.uri);
  const result = await web3wallet.core.pairing.pair({ uri: params.uri });
  console.log("Pairing completed");
  Alert.alert('Pairing', 'Pairing completed');
  return result;
}
