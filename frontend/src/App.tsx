import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Detail from './pages/Detail';
import Profile from './pages/Profile';
import Game from './pages/game/Game';
import CharactersList from './pages/game/CharactersList';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import RequireAuth from './components/RequireAuth';
import CreateDle from './pages/CreateDle';
import CustomDetail from './pages/CustomDetail';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/anime/:id" element={<Detail />} />
        <Route path="/anime/:id/play" element={<Game />} />
        <Route path="/anime/:id/characters" element={<CharactersList />} />
        <Route path="/create" element={<RequireAuth><CreateDle /></RequireAuth>} />
        <Route path="/custom/:id" element={<CustomDetail />} />
        <Route path="/custom/:id/edit" element={<RequireAuth><CreateDle /></RequireAuth>} />
        <Route path="/custom/:id/play" element={<Game />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
