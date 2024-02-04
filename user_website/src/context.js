// MyContext.js
import React, { createContext, useState } from "react";

// Create a context with a default value (in this case, an empty string)
const MyContext = createContext("");

let url = "ws://192.168.148.83:6503";
var socket = new WebSocket(url, "json");

// Create a provider component
const MyContextProvider = ({ children }) => {
  return (
    <MyContext.Provider value={{socket}}>
      {children}
    </MyContext.Provider>);
};

export { MyContext, MyContextProvider };
