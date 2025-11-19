import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Estende Vitest con i matcher di jest-dom
expect.extend(matchers);

// Pulisce dopo ogni test
afterEach(() => {
    cleanup();
});
