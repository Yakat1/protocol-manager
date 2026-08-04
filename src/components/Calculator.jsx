import { useState } from 'react';
import './Calculator.css';
import DilutionCard from './calculators/DilutionCard';
import FentonCard from './calculators/FentonCard';
import StockMolarityCard from './calculators/StockMolarityCard';
import BufferCreator from './calculators/BufferCreator';
import UnitConverterCard from './calculators/UnitConverterCard';
import PHCard from './calculators/PHCard';
import SerialDilutionsCard from './calculators/SerialDilutionsCard';

export default function Calculator({ inventory: inventoryProp, setInventory, bufferRecipes: bufferRecipesProp, setBufferRecipes, user }) {
  const inventory = inventoryProp || [];
  const bufferRecipes = bufferRecipesProp || [];

  const [selectedInventoryId, setSelectedInventoryId] = useState('');

  const handleDiscount = (amount) => {
    if (!inventory || inventory.length === 0) return alert("Inventario no disponible o componente no guardado.");
    if (!selectedInventoryId) return alert("Por favor, selecciona un elemento del inventario.");
    const inv = inventory.find(i => i.id === selectedInventoryId);
    if (!inv) return;
    if (confirm(`Voy a descontar ${amount.toFixed(2)} unds del inventario "${inv.name}". \nStock Actual: ${inv.quantity} ${inv.unit}\n¿Estás de acuerdo?`)) {
      const newQuantity = Math.max(0, inv.quantity - amount);
      setInventory(inventory.map(i => i.id === selectedInventoryId ? { ...i, quantity: newQuantity } : i));
      alert(`Descuento exitoso. Nuevo saldo: ${newQuantity.toFixed(2)} ${inv.unit}`);
    }
  };

  return (
    <div className="calculator-container">
      <div className="calc-cards">
        <DilutionCard
          inventory={inventory}
          selectedInventoryId={selectedInventoryId}
          onSelectedInventoryIdChange={setSelectedInventoryId}
          onDiscount={handleDiscount}
        />
        <FentonCard />
        <StockMolarityCard
          inventory={inventory}
          selectedInventoryId={selectedInventoryId}
          onSelectedInventoryIdChange={setSelectedInventoryId}
          onDiscount={handleDiscount}
        />
        <BufferCreator
          inventory={inventory}
          bufferRecipes={bufferRecipes}
          setBufferRecipes={setBufferRecipes}
          setInventory={setInventory}
          user={user}
        />
        <UnitConverterCard />
        <PHCard />
        <SerialDilutionsCard />
      </div>
    </div>
  );
}