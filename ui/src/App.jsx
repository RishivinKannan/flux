import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ScriptList from './pages/ScriptList';
import ScriptEditor from './pages/ScriptEditor';
import PreviewTester from './pages/PreviewTester';
import TargetList from './pages/TargetList';
import TargetEditor from './pages/TargetEditor';
import NavigationProgress from './components/NavigationProgress'; // Keeping this if needed, or remove if layout handles it.
import Layout from './components/Layout';
import { ThemeProvider } from "./components/theme-provider"

function App() {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <Router>
                <div className="app bg-background min-h-screen font-sans antialiased text-foreground">
                    <NavigationProgress />
                    <Layout>
                        <Routes>
                            <Route path="/" element={<ScriptList />} />
                            <Route path="/edit/:name" element={<ScriptEditor />} />
                            <Route path="/create" element={<ScriptEditor />} />
                            <Route path="/targets" element={<TargetList />} />
                            <Route path="/targets/create" element={<TargetEditor />} />
                            <Route path="/targets/edit/:id" element={<TargetEditor />} />
                            <Route path="/preview" element={<PreviewTester />} />
                        </Routes>
                    </Layout>
                </div>
            </Router>
        </ThemeProvider>
    );
}

export default App;

