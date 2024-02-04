import "./App.css";
import { useContext, useRef, useState } from "react";
import { MyContext, MyContextProvider } from "./context";
import Webcam from "react-webcam";
const config = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
      username: "webrtc",
      credential: "stunserver",
    },
  ],
};
const constraints = {
  audio: false,
  video: {
    cursor: "always",
    displaySurface: "monitor",
  },
};

var pc = null;
var channel = null;
var webcam = null;
var webcam_track = null;
var screen_track = null;
var sendframes = null;
var screenshare = null;
const FPS = 3;


const App = () => {
  const { socket } = useContext(MyContext);
  const selfVideo = useRef();
  const [name, setName] = useState("");
  const [exam, setExam] = useState("");
  const [id, setId] = useState("");
  const [status, setStatus] = useState("");
  const [socketid, setSocketId] = useState("");
  const webcamRef = useRef(null);
  const getFrame = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    return imageSrc;
}
const submit = ()=>{
  socket.send(JSON.stringify({
    type:"submit",
    studentname:name,
    sid:id,
    admin:"1234",
    exam:exam
  }))
  //close webrtc connection
  pc.close();
  //clear frame interval
  clearInterval(sendframes)
}
  socket.onopen = async () => {
    setStatus("connected");
  };
  socket.onclose = () => {
    setStatus("dis-connected");
  };

  socket.onmessage = (msg) => {
    var message = JSON.parse(msg.data);
    //when connecting for the first time
    //we need to send the username
    if (message.type === "id") {
      setSocketId(message.id);
    }

    //webrtc answer sdp
    //{type:answer,sdp:{},id:clientID}
    if (message.type === "answer") {
      console.log("answer received");
      handleAnswer(message.sdp);
    }

    //on new ice candidate
    if (message.type === "new-ice-candidate") {
      handleNewICECandidateMsg(message);
    }

    // warnings
    if (message.type === "warnings") {
      for (let warning in message.warnings) {
        if (warning === "out_of_frame") {
          window.alert("you are out of frame!");
        }
        if (warning === "not_center") {
          window.alert("you are not in centre!");
        }
      }
    }
  };

  async function start() {
    pc = new RTCPeerConnection(config);
    //data channel for bi-directional data transfer...
    channel = pc.createDataChannel("channel");
    channel.onopen = () => console.log("channel is open...");
    channel.onclose = () => console.log("channel is closed...");
    channel.onmessage = handleDataChannelMessage;

    //admin website
    pc.onnegotiationneeded = handleNegotiationNeededEvent;
    
    pc.onicecandidate = handleICECandidateEvent;
    //associate student with the exam code
    socket.send(
      JSON.stringify({
        type: "studentdetails",
        name: name,
        exam: exam,
        admin: "1234",
        sid: id,
        id: socketid,
      })
    );
    screenshare = await navigator.mediaDevices.getDisplayMedia(constraints);
    webcam = await navigator.mediaDevices.getUserMedia(constraints);
    sendframes = setInterval(() => {
      const frame = getFrame();
      socket.send(JSON.stringify({
          type: "frame",
          frame: frame,
          name: name,
          exam: exam,
          admin: "1234",
          sid: id,
      }));


  }, 1000 / FPS);
  }
  function sendToServer(data) {
    data = JSON.stringify(data);
    socket.send(data);
  }
  //admin webrtc event handlers
  async function handleNegotiationNeededEvent() {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // Send the offer to the remote peer.
      sendToServer({
        name: name,
        target: "admin",
        admin: "1234",
        sid: id,
        type: "offer",
        sdp: pc.localDescription,
      });
    } catch (err) {
      console.log("err" + err);
    }
  }
  async function handleAnswer(sdp) {
    var desc = new RTCSessionDescription(sdp);
    await pc.setRemoteDescription(desc).catch((err) => console.log(err));
  }
  function handleICECandidateEvent(event) {
    if (event.candidate) {
      console.log("*** Outgoing ICE candidate: " + event.candidate.candidate);
      sendToServer({
        type: "new-ice-candidate",
        target: "1234",
        to: "admin",
        sid: id,
        candidate: event.candidate,
      });
    }
  }
  async function handleNewICECandidateMsg(msg) {
    var candidate = new RTCIceCandidate(msg.candidate);
    console.log(
      "*** Adding received ICE candidate: " + JSON.stringify(candidate)
    );
    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      reportError(err);
    }
  }
  async function handleDataChannelMessage(msg) {
    let data = JSON.parse(msg.data);
    console.log(data);
    if (data.type === "removestream") {
      if (webcam_track) {
        pc.removeTrack(webcam_track);
      }
      if (screen_track) {
        pc.removeTrack(screen_track);
      }
    }
    if (data.type === "sharemode") {
      if (data.mode === "screen") {
        if (webcam_track) {
          pc.removeTrack(webcam_track);
        }
        try {
          for (const track of screenshare.getTracks()) {
            screen_track = pc.addTrack(track, screenshare);
          }
        } catch (err) {
          console.error(err);
        }
      } else {
        if (screen_track) {
          pc.removeTrack(screen_track);
        }
        try {
          for (const track of webcam.getTracks()) {
            webcam_track = pc.addTrack(track, webcam);
          }
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  return (
    <div>
      <div>
        <h3>socket : {status}</h3>
        <label for="username">Enter your username:</label>
        <input
          type="text"
          name="username"
          onChange={(e) => setName(e.target.value)}
        />
        <label for="examcode">Enter exam code:</label>
        <input
          type="text"
          name="examcode"
          onChange={(e) => setExam(e.target.value)}
        />
        <label for="sid">Enter student id:</label>
        <input type="text" name="sid" onChange={(e) => setId(e.target.value)} />
        <button onClick={start}>Connect</button>
      </div>
      <button onClick={submit}>Submit</button>
      <Webcam
            screenshotFormat="image/jpeg"
            audio={false}
            height={200}
            width={200}
            ref={webcamRef}

          />
    </div>
  );
};

const AppWithContext = () => {
  // Wrap your component with the context provider
  return (
    <MyContextProvider>
      <App />
    </MyContextProvider>
  );
};

export default AppWithContext;
