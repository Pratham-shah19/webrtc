var http = require("http");
var https = require("https");
var fs = require("fs");
var WebSocketServer = require("websocket").server;


// Pathnames of the SSL key and certificate files to use for
// HTTPS connections.
const keyFilePath = "server/server-cert.pem";
const certFilePath = "server/server-cert.pem";


// Used for managing the text chat user list.
var ml = null;

//student has entered exam details
var connectedStudents = {};
var connectedAdmins = {};
var connectionArray = [];
var nextID = Date.now();



// Output logging information to console
function log(text) {
  var time = new Date();
  console.log("[" + time.toLocaleTimeString() + "] " + text);
}


function originIsAllowed(origin) {
  return true; // We will accept all connections
}


// Scan the list of connections and return the one for the specified
// clientID. Each login gets an ID that doesn't change during the session,
// so it can be tracked across username changes.
function getConnectionForID(id) {
  var connect = null;
  var i;

  for (i = 0; i < connectionArray.length; i++) {
    if (connectionArray[i].clientID === id) {
      connect = connectionArray[i];
      break;
    }
  }

  return connect;
}


//send the student details to the proctors
function sendDetailsToAdmins(examcode,admin_id){
  var studentDetails = [];
  
  for(let i=0;i<connectedStudents[examcode].length;i++){
    let obj = {};
    let student = connectedStudents[examcode][i];
    obj.studentname = student.username;
    obj.studentid = student.sid;
    admin_id = student.admin;
    studentDetails.push(obj);
  }
  if(connectedStudents[examcode].length === 0) delete connectedStudents[examcode];
  
  var details_object = {
    type:"exam",
    code:examcode,
    students:studentDetails
  }
  let admin = connectedAdmins[admin_id];
  admin.sendUTF(JSON.stringify(details_object));
}

function sendStudentToAdmin(msg){
  connectedAdmins[msg.admin].sendUTF(JSON.stringify(msg));
}

function sendStudentToML(msg){
  ml.sendUTF(JSON.stringify(msg));
}


// Try to load the key and certificate files for SSL so we can
// do HTTPS (required for non-local WebRTC).
var httpsOptions = {
  key: null,
  cert: null,
};

try {
  httpsOptions.key = fs.readFileSync(keyFilePath);
  try {
    httpsOptions.cert = fs.readFileSync(certFilePath);
  } catch (err) {
    httpsOptions.key = null;
    httpsOptions.cert = null;
  }
} catch (err) {
  httpsOptions.key = null;
  httpsOptions.cert = null;
}

// If we were able to get the key and certificate files, try to
// start up an HTTPS server.
var webServer = null;

try {
  if (httpsOptions.key && httpsOptions.cert) {
    webServer = https.createServer(httpsOptions, handleWebRequest);
  }
} catch (err) {
  webServer = null;
}

if (!webServer) {
  try {
    webServer = http.createServer({}, handleWebRequest);
  } catch (err) {
    webServer = null;
    log(`Error attempting to create HTTP(s) server: ${err.toString()}`);
  }
}


function handleWebRequest(request, response) {
  log("Received request for " + request.url);
  response.write("<html><h3>websocket server</h3></html>");
  response.end();
}

webServer.listen(6503, function () {
  log("Server is listening on port 6503");
});


// Create the WebSocket server by converting the HTTPS server into one.
var wsServer = new WebSocketServer({
  httpServer: webServer,
  autoAcceptConnections: false,
  maxReceivedFrameSize: 131072,
  maxReceivedMessageSize: 10 * 1024 * 1024,
});

if (!wsServer) {
  log("ERROR: Unable to create WebSocket server!");
}


// Set up a "connect" message handler on our WebSocket server. This is
// called whenever a user connects to the server's port using the
// WebSocket protocol
wsServer.on("request", function (request) {
  if (!originIsAllowed(request.origin)) {
    request.reject();
    log("Connection from " + request.origin + " rejected.");
    return;
  }

  // Accept the request and get a connection.
  var connection = request.accept("json", request.origin);

  // Add the new connection to our list of connections.
  log("Connection accepted from " + connection.remoteAddress + ".");
  connection.clientID = nextID;
  connectionArray.push(connection);
  nextID++;
  let isStudent = true;
  let isML = false;

  //sending a id to the student/admin to associate it with the connection object when it sends back some message.
  var msg = {
    type: "id",
    id: connection.clientID,
  };
  connection.sendUTF(JSON.stringify(msg));
  connection.on("message", function (message) {
    if (message.type === "utf8") {
      msg = JSON.parse(message.utf8Data);
      var connect = getConnectionForID(msg.id);
      switch (msg.type) {
        case "studentdetails":
          connect.username = msg.name;
          connect.admin = msg.admin;
          connect.sid = msg.sid;
          connect.exam = msg.exam;
          if(connectedStudents[msg.exam]){
            connectedStudents[msg.exam].push(connect);
          }
          else{
            let arr = [];
            arr.push(connect);
            connectedStudents[msg.exam] = arr;
          }
          //send the connected student details to the corresponding admins
          //this is a bad way of sending the whole list of students, instead of the updates
          sendDetailsToAdmins(msg.exam,msg.admin);

          //function that only sends the updates like if the student has joined or left
          msg.type = 'add';
          sendStudentToAdmin(msg);
          break;

        case "admindetails":
          console.log("admin connected...");
          isStudent = false;
          connect.username = msg.name;
          connectedAdmins[msg.admin] = connect;
          break;
        
        case "ML":
          console.log("ml server connected...");
          isML = true;
          isStudent = false;
          ml = connection;
          break;
        case "submit":
          console.log("deleting student...");
          connectedStudents[msg.exam] = connectedStudents[msg.exam].filter(function(el){
            return el.sid !== msg.sid;
          })
          sendStudentToAdmin({
            type:'del',
            name:msg.studentname,
            sid:msg.sid,
            exam:msg.exam,
            admin:msg.admin
          })
          break;

        case "kick":
          console.log("kicking student...");
          connectedStudents[msg.exam].forEach(e => {
              if(e.sid === msg.sid){
                e.sendUTF(JSON.stringify({
                  type:'kick',
                  name:msg.studentname,
                  sid:msg.sid,
                  exam:msg.exam,
                  admin:msg.admin
                }))
              }
          });
          connectedStudents[msg.exam] = connectedStudents[msg.exam].filter(function(el){
            return el.sid !== msg.sid;
          })
          sendStudentToAdmin({
            type:'del',
            name:msg.studentname,
            sid:msg.sid,
            exam:msg.exam,
            admin:msg.admin
          })
          break;
        case "frame":
          if(ml){
            sendStudentToML(msg)
          }
          break;
        case "audio":
          if(ml){
            sendStudentToML(msg);
          }
          break;
        case "warnings":
          if(msg.to === "student"){
            let target_exam = connectedStudents[msg.exam];
            for(let i=0;i<target_exam.length;i++){
              if(target_exam[i].sid === msg.sid){
                target_exam[i].sendUTF(JSON.stringify(msg));
                break;
              }
            } 
          }
          if(msg.to === "admin"){
            sendStudentToAdmin(msg);
          }
          break;

        case "offer":
          if(msg.target === 'admin'){
            sendStudentToAdmin(msg);
          }
          break;
        
        case "answer":
          let target_exam = connectedStudents[msg.exam];
          for(let i=0;i<target_exam.length;i++){
            if(target_exam[i].sid === msg.target){
              target_exam[i].sendUTF(JSON.stringify(msg));
              break;
            }
          } 
          break;
        
        case "new-ice-candidate":
          
          if(msg.to === 'admin'){
            connectedAdmins[msg.target].sendUTF(JSON.stringify(msg));
          }
          else if(msg.to === 'student'){
            let student_arr = connectedStudents[msg.exam];
            for(let i =0;i<student_arr.length;i++){
              if(student_arr[i].sid === msg.target){
                student_arr[i].sendUTF(JSON.stringify(msg));
                break;
              }
            }
          }
          break;

      } 
      
    }
  });

  // Handle the WebSocket "close" event; this means a user has logged off
  // or has been disconnected.
  connection.on("close", function (reason, description) {
    // First, remove the connection from the list of connections.
    connectionArray = connectionArray.filter(function (el) {
      return el.connected;
    });

    if(isML){
      console.log("ml disconnected")
      ml = null;
    }
    

    var logMessage =
      "Connection closed: " + connection.remoteAddress + " (" + reason;
    if (description !== null && description.length !== 0) {
      logMessage += ": " + description;
    }
    logMessage += ")";
    log(logMessage);
  });
});
