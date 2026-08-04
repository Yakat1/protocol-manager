import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DilutionCard from './DilutionCard';

const inventory = [
  { id: 'inv-1', name: 'Stock A', quantity: 100, unit: 'µL' },
  { id: 'inv-2', name: 'Stock B', quantity: 50, unit: 'µL' },
];

describe('DilutionCard', () => {
  it('renders the card title and input fields', () => {
    render(
      <DilutionCard
        inventory={inventory}
        selectedInventoryId=""
        onSelectedInventoryIdChange={() => {}}
        onDiscount={() => {}}
      />
    );
    expect(screen.getByText('Dilución Simple (C₁V₁ = C₂V₂)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ej. 1000 µM')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ej. 150 µM')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ej. 1000 µL')).toBeInTheDocument();
  });

  it('computes V1 = (C2 * Vf) / C1 and shows the result', () => {
    render(
      <DilutionCard
        inventory={inventory}
        selectedInventoryId=""
        onSelectedInventoryIdChange={() => {}}
        onDiscount={() => {}}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('ej. 1000 µM'), { target: { value: '1000' } });
    fireEvent.change(screen.getByPlaceholderText('ej. 150 µM'), { target: { value: '150' } });
    fireEvent.change(screen.getByPlaceholderText('ej. 1000 µL'), { target: { value: '1000' } });

    expect(screen.getByText('150.00 c.u.')).toBeInTheDocument();
  });

  it('shows the inventory selector and discount button when inventory exists', () => {
    render(
      <DilutionCard
        inventory={inventory}
        selectedInventoryId=""
        onSelectedInventoryIdChange={() => {}}
        onDiscount={() => {}}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('ej. 1000 µM'), { target: { value: '1000' } });
    fireEvent.change(screen.getByPlaceholderText('ej. 150 µM'), { target: { value: '150' } });
    fireEvent.change(screen.getByPlaceholderText('ej. 1000 µL'), { target: { value: '1000' } });

    expect(screen.getByText('Seleccionar Reactivo...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descontar stock/i })).toBeInTheDocument();
  });

  it('calls onDiscount with the computed volume', () => {
    const onDiscount = vi.fn();
    render(
      <DilutionCard
        inventory={inventory}
        selectedInventoryId="inv-1"
        onSelectedInventoryIdChange={() => {}}
        onDiscount={onDiscount}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('ej. 1000 µM'), { target: { value: '1000' } });
    fireEvent.change(screen.getByPlaceholderText('ej. 150 µM'), { target: { value: '150' } });
    fireEvent.change(screen.getByPlaceholderText('ej. 1000 µL'), { target: { value: '1000' } });

    fireEvent.click(screen.getByRole('button', { name: /descontar stock/i }));
    expect(onDiscount).toHaveBeenCalledWith(150);
  });
});