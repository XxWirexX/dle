import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Detail from './pages/Detail';
import Game from './pages/Game';
import CharactersList from './pages/CharactersList';
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
            path="/anime/:id"
            element={<Detail />}
        />
        <Route
            path="/anime/:id/play"
            element={<Game />}
        />
        <Route
            path="/anime/:id/characters"
            element={<CharactersList />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
