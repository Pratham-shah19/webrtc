// MyContext.js
import React, { createContext, useState } from "react";

// Create a context with a default value (in this case, an empty string)
const MyContext = createContext("");
const config = {
  iceServers: [
    {
      urls: "turn:124.64.206.224:8800",
      username: "webrtc",
      credential: "turnserver",
    },
  ],
};
let url = "ws://192.168.1.8:6503";
var socket = new WebSocket(url, "json");

class webrtc {
  constructor(message) {
    console.log(message);
    this.exam = message.exam;
    this.name = message.name;
    this.id = message.sid;
    this.index = message.index;
    this.rc = new RTCPeerConnection(config);
    this.rc.ondatachannel = this.handleDataChannel.bind(this);
    this.rc.onicecandidate = this.handleICECandidateEvent.bind(this);
  }

  sendToServer(data) {
    data = JSON.stringify(data);
    socket.send(data);
  }
  handleDataChannel(evt) {
    this.rc.channel = evt.channel;
    this.rc.channel.onopen = () => console.log("channel is open...");
    this.rc.channel.onclose = () => console.log("channel is closed...");
    this.rc.channel.onmessage = (msg) =>
      console.log("channel message:" + msg.data);
  }

  handleICECandidateEvent(event) {
    if (event.candidate) {
      console.log("*** Outgoing ICE candidate: " + event.candidate.candidate);
      this.sendToServer({
        type: "new-ice-candidate",
        target: this.id,
        to: "student",
        exam: this.exam,
        candidate: event.candidate,
        from: "admin",
      });
    }
  }

  async handleOffer(msg) {
    let sdp = msg.sdp;
    let desc = new RTCSessionDescription(sdp);
    await this.rc.setRemoteDescription(desc);
    await this.rc.setLocalDescription(await this.rc.createAnswer());
    this.sendToServer({
      name: "admin",
      target: this.id,
      exam: this.exam,
      type: "answer",
      sdp: this.rc.localDescription,
    });
  }

  async handleNewICECandidateMsg(msg) {
    var candidate = new RTCIceCandidate(msg.candidate);
    console.log(
      "*** Adding received ICE candidate: " + JSON.stringify(candidate)
    );
    try {
      await this.rc.addIceCandidate(candidate);
    } catch (err) {
      console.log("err:" + err);
    }
  }
}
// Create a provider component
const MyContextProvider = ({ children }) => {
  const [status, setStatus] = useState("dis-connected");
  const [currentstudent, setCurrentStudent] = useState(null);
  const [livestudent, setLiveStudents] = useState({});
  const [studentwarning, setStudentWarning] = useState({});
  socket.onopen = () => {
    setStatus("connected");
  };
  socket.onclose = () => {
    setStatus("dis-connected");
  };
  socket.onmessage = async (msg) => {
    var message = JSON.parse(msg.data);
    //when connecting for the first time
    //we need to send the username
    if (message.type === "id") {
      console.log("socket connected");
      var newname = {
        type: "admindetails",
        name: "admin",
        id: message.id,
        admin: "1234", //admin id
      };
      socket.send(JSON.stringify(newname));
    }

    //warnings
    if (message.type === "warnings") {
      let warnings = studentwarning[message.sid];
      for (const x in message.warnings) {
        warnings[x] += 1;
      }
     setStudentWarning((prevState)=>({
        ...prevState,
        [message.sid]:warnings
     }))
    }

    //new student added
    if (message.type === "add") {
      console.log("add student");
      setStudentWarning((prevState) => ({
        ...prevState,
        [message.sid]:{
            out_of_frame:0,
            low_light:0,
            multiple_faces:0,
            mobile_detected:0,
            not_center:0,
            left:0,
            right:0,
            up:0,
            down:0
          }
      }))
      setLiveStudents((prevState) => ({
        ...prevState,
        [message.sid]: {
          rtc: new webrtc(message),
        },
      }));
    }

    //student deleted
    if (message.type === "del") {
      console.log("delete student");
      setLiveStudents((prevState) => {
        const { [message.sid]: deletedKey, ...rest } = prevState;
        return rest;
      });
    }
    //webrtc offer
    if (message.type === "offer") {
      console.log("offer received");
      let student_connection = livestudent[message.sid];
      student_connection.rtc.handleOffer(message);
    }

    //new ice candidate received
    if (message.type === "new-ice-candidate") {
      console.log("new ice candidate:");
      let student_connection = livestudent[message.sid];
      await student_connection.rtc.handleNewICECandidateMsg(message);
    }
  };

  return (
    <MyContext.Provider
      value={{ status, livestudent, currentstudent, setCurrentStudent,studentwarning }}
    >
      {children}
    </MyContext.Provider>
  );
};

export { MyContext, MyContextProvider };
