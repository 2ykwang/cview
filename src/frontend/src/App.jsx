import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SessionSelect from './pages/SessionSelect';
import Messenger from './pages/Messenger';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SessionSelect />} />
        <Route path="/session" element={<Messenger />} />
      </Routes>
    </BrowserRouter>
  );
}
