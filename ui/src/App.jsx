import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import ScriptList from './pages/ScriptList';
import ScriptEditor from './pages/ScriptEditor';
import PreviewTester from './pages/PreviewTester';
import TargetList from './pages/TargetList';
import TargetEditor from './pages/TargetEditor';
import NavigationProgress from './components/NavigationProgress';

function App() {
    return (
        <Router>
            <div className="app">
                <NavigationProgress />
                <header className="header">
                    <div className="header-content">
                        <div className="logo">⚡ FLUX</div>
                        <nav className="nav">
                            <NavLink to="/" end>Scripts</NavLink>
                            <NavLink to="/targets">Targets</NavLink>
                            <NavLink to="/preview">Preview Tester</NavLink>
                        </nav>
                    </div>
                </header>

                <main className="main">
                    <Routes>
                        <Route path="/" element={<ScriptList />} />
                        <Route path="/edit/:name" element={<ScriptEditor />} />
                        <Route path="/create" element={<ScriptEditor />} />
                        <Route path="/targets" element={<TargetList />} />
                        <Route path="/targets/create" element={<TargetEditor />} />
                        <Route path="/targets/edit/:id" element={<TargetEditor />} />
                        <Route path="/preview" element={<PreviewTester />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
