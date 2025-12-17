import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Play, TestTube2, ArrowRight } from "lucide-react";

function PreviewTester() {
    const [scripts, setScripts] = useState([]);
    const [selectedScript, setSelectedScript] = useState('');
    const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
    const [params, setParams] = useState('{\n  "userId": "123"\n}');
    const [body, setBody] = useState('{\n  "message": "Hello World"\n}');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadScripts();
    }, []);

    const loadScripts = async () => {
        try {
            const data = await api.fetchScripts();
            const scriptNames = (data.scripts || []).map(s => s.name);
            setScripts(scriptNames);
            if (scriptNames.length > 0 && !selectedScript) {
                setSelectedScript(scriptNames[0]);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handlePreview = async () => {
        if (!selectedScript) {
            setError('Please select a script');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Parse JSON inputs
            const sampleData = {
                headers: JSON.parse(headers),
                params: JSON.parse(params),
                body: JSON.parse(body)
            };

            const data = await api.previewTransformation(selectedScript, sampleData);
            setResult(data);
        } catch (err) {
            setError(err.message);
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-6 max-w-6xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Preview Tester</h1>
                    <p className="text-muted-foreground mt-2">
                        Test your transformation scripts with sample data
                    </p>
                </div>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TestTube2 className="h-5 w-5" /> Test Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="grid gap-2 flex-1">
                            <Label htmlFor="scriptSelect">Select Script</Label>
                            <Select value={selectedScript} onValueChange={setSelectedScript}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a script" />
                                </SelectTrigger>
                                <SelectContent>
                                    {scripts.map(name => (
                                        <SelectItem key={name} value={name}>{name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={handlePreview}
                            disabled={loading || !selectedScript}
                            className="w-full md:w-auto min-w-[150px]"
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            Test Transformation
                        </Button>
                    </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Input Section */}
                    <Card className="flex flex-col">
                        <CardHeader className="bg-muted/30 pb-3">
                            <CardTitle className="text-base text-muted-foreground">📤 Sample Input</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 pt-6 flex-1">
                            <div className="grid gap-2">
                                <Label>Headers (JSON)</Label>
                                <Textarea
                                    value={headers}
                                    onChange={(e) => setHeaders(e.target.value)}
                                    rows={6}
                                    className="font-mono text-xs"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Query Parameters (JSON)</Label>
                                <Textarea
                                    value={params}
                                    onChange={(e) => setParams(e.target.value)}
                                    rows={4}
                                    className="font-mono text-xs"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Body (JSON)</Label>
                                <Textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    rows={6}
                                    className="font-mono text-xs"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Output Section */}
                    <Card className="flex flex-col">
                        <CardHeader className="bg-muted/30 pb-3">
                            <CardTitle className="text-base text-muted-foreground">📤 Transformed Output</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 pt-6">
                            {result ? (
                                <div className="grid gap-6">
                                    <div className="bg-primary/5 border rounded-lg p-4">
                                        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                            <ArrowRight className="h-4 w-4" /> Operations Applied
                                        </h4>
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div className={`flex items-center gap-1 ${result.applied.transformHeaders ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                                                {result.applied.transformHeaders ? '✓' : '•'} Headers
                                            </div>
                                            <div className={`flex items-center gap-1 ${result.applied.transformParams ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                                                {result.applied.transformParams ? '✓' : '•'} Params
                                            </div>
                                            <div className={`flex items-center gap-1 ${result.applied.transformBody ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                                                {result.applied.transformBody ? '✓' : '•'} Body
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Headers</Label>
                                        <div className="bg-muted rounded-md p-3 overflow-x-auto">
                                            <pre className="text-xs font-mono">{JSON.stringify(result.transformed.headers, null, 2)}</pre>
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Query Parameters</Label>
                                        <div className="bg-muted rounded-md p-3 overflow-x-auto">
                                            <pre className="text-xs font-mono">{JSON.stringify(result.transformed.params, null, 2)}</pre>
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Body</Label>
                                        <div className="bg-muted rounded-md p-3 overflow-x-auto">
                                            <pre className="text-xs font-mono">{JSON.stringify(result.transformed.body, null, 2)}</pre>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground min-h-[300px]">
                                    <TestTube2 className="h-12 w-12 mb-4 opacity-20" />
                                    <p>Run a test to see results</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default PreviewTester;
