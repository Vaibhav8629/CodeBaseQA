import { Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Workspace from './workspace/Workspace';
import './workspace/workspace.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/workspace" element={<Workspace />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}