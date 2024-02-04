import "./App.css";
import { useContext, useRef, useState } from "react";
import { MyContext, MyContextProvider } from "./context";

const App = () => {
  // Consume the context using useContext hook
  const { status, livestudent, currentstudent ,setCurrentStudent,studentwarning} = useContext(MyContext);
  const remoteVideo = useRef();

  //webcam and screenshare button handlers
  const webcambutton = (id) => {
    //remove stream if there is already some one live
    if (currentstudent && livestudent[currentstudent]) {
      livestudent[currentstudent].rtc.rc.channel.send(
        JSON.stringify({
          type: "removestream",
        })
      );
    }
    let student_channel = livestudent[id].rtc.rc.channel;
    setCurrentStudent(id);
    console.log("webbutton:" + id);
    livestudent[id].rtc.rc.ontrack = (evt)=>{ remoteVideo.current.srcObject = evt.streams[0]}
    student_channel.send(
      JSON.stringify({
        type: "sharemode",
        mode: "webcam",
      })
    );
  };

  const kickstudent = (id) => {
    console.log("kick student" + id);
  };
  const screenbutton = (id)=>{
    //remove stream if there is already some one live
    if (currentstudent && livestudent[currentstudent]) {
      livestudent[currentstudent].rtc.rc.channel.send(
        JSON.stringify({
          type: "removestream",
        })
      );
    }
    let student_channel = livestudent[id].rtc.rc.channel;
    setCurrentStudent(id);
    livestudent[id].rtc.rc.ontrack = (evt)=>{ remoteVideo.current.srcObject = evt.streams[0]}

    student_channel.send(
      JSON.stringify({
        type: "sharemode",
        mode: "screen",
      })
    );
  }
  return (
    <div>
      <h1>Admin page</h1>
      {status}
      {Object.keys(livestudent).length !== 0 ? (
        <div>
          <table>
            <tr>
              <th>Name</th>
              <th>ID</th>
              <th>Actions</th>
              <th>Out of frame</th>
              <th>Low light</th>
              <th>Multiple faces</th>
              <th>Mobile detected</th>
              <th>Not center</th>
              <th>Left</th>
              <th>Right</th>
              <th>Up</th>
              <th>Down</th>

            </tr>
            {Object.keys(livestudent).map((sid) => {
              return (
                <tr>
                  <td>{livestudent[sid].rtc.name}</td>
                  <td>{livestudent[sid].rtc.id}</td>
                  <td>
                    <button onClick={()=>{webcambutton(sid)}}>Webcam</button>
                    <button onClick={()=>{screenbutton(sid)}}>Screen</button>
                    <button onClick={()=>{kickstudent(sid)}}>Kick</button>
                  </td>
                  <td>{studentwarning[sid]["out_of_frame"]}</td>
                  <td>{studentwarning[sid]["low_light"]}</td>
                  <td>{studentwarning[sid]["multiple_faces"]}</td>
                  <td>{studentwarning[sid]["mobile_detected"]}</td>
                  <td>{studentwarning[sid]["not_center"]}</td>
                  <td>{studentwarning[sid]["left"]}</td>
                  <td>{studentwarning[sid]["right"]}</td>
                  <td>{studentwarning[sid]["up"]}</td>
                  <td>{studentwarning[sid]["down"]}</td>

                </tr>
              );
            })}
          </table>
          <video autoPlay playsInline muted ref={remoteVideo}></video>
        </div>
      ) : (
        <div>
          <h3>NO STUDENTS ARE LIVE</h3>
        </div>
      )}
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
