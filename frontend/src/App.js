import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './components/Landing';
import Waiting from './components/Waiting';
import Game from './components/Game';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/waiting/:roomName/:playerName" element={<Waiting />} />
          <Route path="/game/:roomName/:playerName" element={<Game />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
