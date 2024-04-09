import "fast-text-encoding";
import "@walletconnect/react-native-compat";
import { Button, StyleSheet, Text, TextInput, View, Linking, ScrollView, Alert } from "react-native";
import { registerRootComponent } from "expo";
import { SignClientTypes, SessionTypes } from "@walletconnect/types";
import { getSdkError } from "@walletconnect/utils";

import useInitialization, {
  currentETHAddress,
  web3wallet,
  web3WalletPair,
} from "../utils/WalletConnectUtils";
import React, { useCallback, useEffect, useState } from "react";
import PairingModal from "./PairingModal";
import { EIP155_SIGNING_METHODS } from "../utils/EIP155Lib";
import SignModal from "./SignModal";
import { parseWalletConnectUri } from "@walletconnect/utils";

export default function App() {
  useInitialization();

  const [modalVisible, setModalVisible] = useState(false);
  const [signModalVisible, setSignModalVisible] = useState(false);
  const [successfulSession, setSuccessfulSession] = useState(false);

  const [currentProposal, setCurrentProposal] = useState();

  const [requestSession, setRequestSession] = useState();
  const [requestEventData, setRequestEventData] = useState();

  useEffect(() => {
    const handleOpenURL = async (event: { url: string }) => {
      const url = event.url;
      console.log('Received deep link:', url);
      Alert.alert('Deep Link', `Received deep link: ${url}`);
      if (url.startsWith('web3wallettutorial://wc')) {
        const wcUri = url.replace('web3wallettutorial://wc?uri=', '');
        await pair(wcUri);
      }
    };

    const linkingSubscription = Linking.addEventListener('url', handleOpenURL);

    return () => {
      linkingSubscription.remove();
    };
  }, []);

  async function pair(uri: string) {
    try {
      console.log('Pairing with URI:', uri);
      const { topic, params } = await web3WalletPair({ uri });
      console.log('Pairing successful. Topic:', topic);
      Alert.alert('Pairing Successful', `Pairing successful. Topic: ${topic}`);
      setCurrentProposal({ id: topic, params });
      setModalVisible(true);
    } catch (error) {
      console.log('Error pairing:', error);
      Alert.alert('Pairing Error', `Error pairing: ${error}`);
    }
  }

  const onSessionProposal = useCallback(
    (proposal: SignClientTypes.EventArguments["session_proposal"]) => {
      console.log('Received session proposal:', proposal);
      Alert.alert('Session Proposal', 'Received session proposal');
      setModalVisible(true);
      setCurrentProposal(proposal);
    },
    []
  );

  async function handleAccept() {
    const { id, params } = currentProposal;
    const { requiredNamespaces, relays } = params;

    if (currentProposal) {
      const namespaces: SessionTypes.Namespaces = {};
      Object.keys(requiredNamespaces).forEach((key) => {
        const accounts: string[] = [];
        requiredNamespaces[key].chains.map((chain) => {
          [currentETHAddress].map((acc) => accounts.push(`${chain}:${acc}`));
        });

        namespaces[key] = {
          accounts,
          methods: requiredNamespaces[key].methods,
          events: requiredNamespaces[key].events,
        };
      });

      console.log('Approving session with namespaces:', namespaces);
      await web3wallet.approveSession({
        id,
        relayProtocol: relays[0].protocol,
        namespaces,
      });

      setModalVisible(false);
      setCurrentProposal(undefined);
      setSuccessfulSession(true);
      Alert.alert('Session Approved', 'Session approved successfully');
    }
  }

  async function disconnect() {
    const activeSessions = await web3wallet.getActiveSessions();
    const topic = Object.values(activeSessions)[0].topic;

    if (activeSessions) {
      console.log('Disconnecting session with topic:', topic);
      await web3wallet.disconnectSession({
        topic,
        reason: getSdkError("USER_DISCONNECTED"),
      });
      Alert.alert('Session Disconnected', `Disconnected session with topic: ${topic}`);
    }
    setSuccessfulSession(false);
  }

  async function handleReject() {
    const { id } = currentProposal;

    if (currentProposal) {
      console.log('Rejecting session proposal with id:', id);
      await web3wallet.rejectSession({
        id,
        reason: getSdkError("USER_REJECTED_METHODS"),
      });

      setModalVisible(false);
      setCurrentProposal(undefined);
      Alert.alert('Session Rejected', `Rejected session proposal with id: ${id}`);
    }
  }

  const onSessionRequest = useCallback(
    async (requestEvent: SignClientTypes.EventArguments["session_request"]) => {
      const { topic, params } = requestEvent;
      const { request } = params;
      const requestSessionData =
        web3wallet.engine.signClient.session.get(topic);

      console.log('Received session request:', requestEvent);
      Alert.alert('Session Request', 'Received session request');

      switch (request.method) {
        case EIP155_SIGNING_METHODS.ETH_SIGN:
        case EIP155_SIGNING_METHODS.PERSONAL_SIGN:
          setRequestSession(requestSessionData);
          setRequestEventData(requestEvent);
          setSignModalVisible(true);
          break;
        case EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION:
          console.log('Received transaction request:', request.params);
          const approved = await showTransactionApprovalUI(request.params);
          
          if (approved) {
            console.log('User approved transaction');
            Alert.alert('Transaction Approved', 'User approved transaction');
            const result = await web3wallet.sendTransaction(requestEvent);
            await web3wallet.respondSessionRequest({
              topic,
              response: result,
            });
          } else {
            console.log('User rejected transaction');
            Alert.alert('Transaction Rejected', 'User rejected transaction');
            await web3wallet.respondSessionRequest({
              topic,
              response: {
                error: getSdkError('USER_REJECTED_METHODS'),
              },
            });
          }
          break;
        default:
          console.log('Unsupported request method:', request.method);
          Alert.alert('Unsupported Request', `Unsupported request method: ${request.method}`);
          break;
      }
    },
    []
  );

  useEffect(() => {
    web3wallet?.on("session_proposal", onSessionProposal);
    web3wallet?.on("session_request", onSessionRequest);
  }, [
    handleAccept,
    handleReject,
    currentETHAddress,
    onSessionRequest,
    onSessionProposal,
    successfulSession,
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.container}>
        <Text>Web3Wallet Tutorial</Text>
        <Text style={styles.addressContent}>
          ETH Address: {currentETHAddress ? currentETHAddress : "Loading..."}
        </Text>

        {successfulSession ? (
          <Button onPress={() => disconnect()} title="Disconnect" />
        ) : null}
      </View>

      <PairingModal
        handleAccept={handleAccept}
        handleReject={handleReject}
        visible={modalVisible}
        setModalVisible={setModalVisible}
        currentProposal={currentProposal}
      />

      <SignModal
        visible={signModalVisible}
        setModalVisible={setSignModalVisible}
        requestEvent={requestEventData}
        requestSession={requestSession}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContentContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 34,
    borderWidth: 1,
    width: "100%",
    height: "40%",
    position: "absolute",
    bottom: 0,
  },
  textInputContainer: {
    height: 40,
    width: 250,
    borderColor: "gray",
    borderWidth: 1,
    borderRadius: 10,
    marginVertical: 10,
    padding: 4,
  },
  addressContent: {
    textAlign: "center",
    marginVertical: 8,
  },
});

registerRootComponent(App);
