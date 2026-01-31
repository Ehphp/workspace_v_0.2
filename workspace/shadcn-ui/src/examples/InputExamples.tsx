/**
 * Example Usage: BaseInput Component
 * 
 * This file demonstrates how to use the refactored input components
 * with consistent four-sided focus borders and state management.
 */

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BaseInputWrapper } from '@/components/ui/base-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Lock, Search, CheckCircle, AlertCircle } from 'lucide-react';

export function InputExamples() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [description, setDescription] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Validation states
    const emailValid = email.includes('@');
    const passwordValid = password.length >= 6;

    return (
        <div className="space-y-8 p-8 max-w-2xl mx-auto">
            <div>
                <h2 className="text-2xl font-bold mb-4">Input Focus Border Examples</h2>
                <p className="text-muted-foreground mb-6">
                    All inputs now show consistent focus borders on all four sides.
                </p>
            </div>

            {/* Basic Inputs */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Inputs</h3>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Email (Default State)</label>
                    <Input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Focus to see uniform border on all sides</p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Password (Default State)</label>
                    <Input
                        type="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
            </section>

            {/* State Examples */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold">Input States</h3>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Email (with validation)</label>
                    <Input
                        type="email"
                        placeholder="email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        state={!email ? 'default' : emailValid ? 'success' : 'error'}
                    />
                    {email && !emailValid && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Please enter a valid email
                        </p>
                    )}
                    {email && emailValid && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Valid email format
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Password (with validation)</label>
                    <Input
                        type="password"
                        placeholder="Minimum 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        state={!password ? 'default' : passwordValid ? 'success' : 'error'}
                    />
                    {password && !passwordValid && (
                        <p className="text-xs text-destructive">Password must be at least 6 characters</p>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Disabled Input</label>
                    <Input
                        type="text"
                        placeholder="This input is disabled"
                        disabled
                        value="Cannot edit"
                    />
                </div>
            </section>

            {/* Input with Icons */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold">Inputs with Icons</h3>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Search with Icon</label>
                    <BaseInputWrapper
                        leftIcon={<Search className="h-4 w-4" />}
                        helperText="Search by name, email, or ID"
                    >
                        <Input
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </BaseInputWrapper>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Email with Icon</label>
                    <BaseInputWrapper
                        leftIcon={<Mail className="h-4 w-4" />}
                        state={email && !emailValid ? 'error' : email && emailValid ? 'success' : 'default'}
                        helperText={
                            email && !emailValid
                                ? 'Invalid email format'
                                : email && emailValid
                                    ? 'Email looks good!'
                                    : 'Enter your email address'
                        }
                    >
                        <Input
                            type="email"
                            placeholder="email@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10"
                            state={email && !emailValid ? 'error' : email && emailValid ? 'success' : 'default'}
                        />
                    </BaseInputWrapper>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Password with Icon</label>
                    <BaseInputWrapper leftIcon={<Lock className="h-4 w-4" />}>
                        <Input
                            type="password"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10"
                        />
                    </BaseInputWrapper>
                </div>
            </section>

            {/* Textarea */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold">Textarea</h3>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                        placeholder="Enter a detailed description..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                        {description.length} / 500 characters
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Textarea with State</label>
                    <Textarea
                        placeholder="This textarea has an error"
                        state="error"
                        rows={3}
                    />
                    <p className="text-xs text-destructive">This field is required</p>
                </div>
            </section>

            {/* Select */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold">Select Dropdown</h3>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Choose an option</label>
                    <Select>
                        <SelectTrigger>
                            <SelectValue placeholder="Select an option..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="option1">Option 1</SelectItem>
                            <SelectItem value="option2">Option 2</SelectItem>
                            <SelectItem value="option3">Option 3</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Focus shows ring on all sides</p>
                </div>
            </section>

            {/* Focus Test Section */}
            <section className="space-y-4 p-4 border-2 border-dashed border-slate-300 rounded-lg">
                <h3 className="text-lg font-semibold">Focus Test</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Use Tab to navigate through these inputs and verify the focus ring appears on all four sides.
                </p>
                <Input placeholder="First input" />
                <Input placeholder="Second input" />
                <Textarea placeholder="Textarea" rows={2} />
                <Select>
                    <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="test">Test</SelectItem>
                    </SelectContent>
                </Select>
            </section>
        </div>
    );
}
