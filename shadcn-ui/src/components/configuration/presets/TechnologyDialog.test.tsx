import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TechnologyDialog } from './TechnologyDialog';
import type { PresetForm } from '@/hooks/usePresetManagement';
import type { Activity, Driver, Risk } from '@/types/database';

// Mock data
const mockActivities: Activity[] = [
    { id: '1', code: 'ACT1', name: 'Activity 1', base_hours: 10, description: '', created_at: '' },
    { id: '2', code: 'ACT2', name: 'Activity 2', base_hours: 20, description: '', created_at: '' },
];

const mockDrivers: Driver[] = [
    {
        id: '1',
        code: 'DRV1',
        name: 'Driver 1',
        description: '',
        options: [
            { value: 'LOW', label: 'Low', multiplier: 0.8 },
            { value: 'HIGH', label: 'High', multiplier: 1.2 },
        ],
        created_at: '',
    },
];

const mockRisks: Risk[] = [
    { id: '1', code: 'RISK1', name: 'Risk 1', description: '', mitigation: '', created_at: '' },
    { id: '2', code: 'RISK2', name: 'Risk 2', description: '', mitigation: '', created_at: '' },
];

const mockTechCategories = ['FULLSTACK', 'BACKEND', 'FRONTEND'];

const mockInitialData: PresetForm = {
    name: 'Test Technology',
    description: 'Test description',
    techCategory: 'FULLSTACK',
    activities: [],
    driverValues: {},
    riskCodes: [],
};

describe('TechnologyDialog', () => {
    const mockOnSave = vi.fn();
    const mockOnOpenChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly when open', () => {
        render(
            <TechnologyDialog
                open={true}
                onOpenChange={mockOnOpenChange}
                initialData={mockInitialData}
                isEditing={false}
                saving={false}
                onSave={mockOnSave}
                allActivities={mockActivities}
                allDrivers={mockDrivers}
                allRisks={mockRisks}
                techCategories={mockTechCategories}
            />
        );

        expect(screen.getByText('Crea Nuova Tecnologia')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Es. Sviluppo Backend Standard')).toBeInTheDocument();
    });

    it('displays "Modifica Tecnologia" title when editing', () => {
        render(
            <TechnologyDialog
                open={true}
                onOpenChange={mockOnOpenChange}
                initialData={mockInitialData}
                isEditing={true}
                saving={false}
                onSave={mockOnSave}
                allActivities={mockActivities}
                allDrivers={mockDrivers}
                allRisks={mockRisks}
                techCategories={mockTechCategories}
            />
        );

        expect(screen.getByText('Modifica Tecnologia')).toBeInTheDocument();
    });

    it('validates name field (minimum 3 characters)', async () => {
        const user = userEvent.setup();

        render(
            <TechnologyDialog
                open={true}
                onOpenChange={mockOnOpenChange}
                initialData={{ ...mockInitialData, name: '' }}
                isEditing={false}
                saving={false}
                onSave={mockOnSave}
                allActivities={mockActivities}
                allDrivers={mockDrivers}
                allRisks={mockRisks}
                techCategories={mockTechCategories}
            />
        );

        const nameInput = screen.getByPlaceholderText('Es. Sviluppo Backend Standard');

        // Clear and type less than 3 characters
        await user.clear(nameInput);
        await user.type(nameInput, 'AB');

        // Try to submit
        const submitButton = screen.getByText('Salva Tecnologia');
        await user.click(submitButton);

        // Should show validation error
        await waitFor(() => {
            expect(screen.getByText('Il nome deve avere almeno 3 caratteri')).toBeInTheDocument();
        });

        // onSave should not be called
        expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('disables save button when form is not dirty', () => {
        render(
            <TechnologyDialog
                open={true}
                onOpenChange={mockOnOpenChange}
                initialData={mockInitialData}
                isEditing={false}
                saving={false}
                onSave={mockOnSave}
                allActivities={mockActivities}
                allDrivers={mockDrivers}
                allRisks={mockRisks}
                techCategories={mockTechCategories}
            />
        );

        const submitButton = screen.getByText('Salva Tecnologia');
        expect(submitButton).toBeDisabled();
    });

    it('calls onSave with form data when valid', async () => {
        const user = userEvent.setup();
        mockOnSave.mockResolvedValue(undefined);

        render(
            <TechnologyDialog
                open={true}
                onOpenChange={mockOnOpenChange}
                initialData={{ ...mockInitialData, name: '' }}
                isEditing={false}
                saving={false}
                onSave={mockOnSave}
                allActivities={mockActivities}
                allDrivers={mockDrivers}
                allRisks={mockRisks}
                techCategories={mockTechCategories}
            />
        );

        const nameInput = screen.getByPlaceholderText('Es. Sviluppo Backend Standard');
        await user.type(nameInput, 'Valid Technology Name');

        const submitButton = screen.getByText('Salva Tecnologia');
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Valid Technology Name',
                    techCategory: 'FULLSTACK',
                })
            );
        });
    });

    it('displays saving state correctly', () => {
        render(
            <TechnologyDialog
                open={true}
                onOpenChange={mockOnOpenChange}
                initialData={mockInitialData}
                isEditing={false}
                saving={true}
                onSave={mockOnSave}
                allActivities={mockActivities}
                allDrivers={mockDrivers}
                allRisks={mockRisks}
                techCategories={mockTechCategories}
            />
        );

        const submitButton = screen.getByText('Salvataggio...');
        expect(submitButton).toBeDisabled();
    });

    it('resets form when dialog opens', async () => {
        const { rerender } = render(
            <TechnologyDialog
                open={false}
                onOpenChange={mockOnOpenChange}
                initialData={mockInitialData}
                isEditing={false}
                saving={false}
                onSave={mockOnSave}
                allActivities={mockActivities}
                allDrivers={mockDrivers}
                allRisks={mockRisks}
                techCategories={mockTechCategories}
            />
        );

        // Reopen with new data
        const newData = { ...mockInitialData, name: 'New Name' };
        rerender(
            <TechnologyDialog
                open={true}
                onOpenChange={mockOnOpenChange}
                initialData={newData}
                isEditing={false}
                saving={false}
                onSave={mockOnSave}
                allActivities={mockActivities}
                allDrivers={mockDrivers}
                allRisks={mockRisks}
                techCategories={mockTechCategories}
            />
        );

        const nameInput = screen.getByPlaceholderText('Es. Sviluppo Backend Standard');
        expect(nameInput).toHaveValue('New Name');
    });
});
