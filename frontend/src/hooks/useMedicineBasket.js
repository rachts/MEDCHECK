import { useMedicine } from '../context/MedicineContext';

export function useMedicineBasket() {
  const {
    medicines,
    addMedicine,
    removeMedicine,
    clearBasket,
    inputError,
    canCheck,
  } = useMedicine();

  return {
    medicines,
    count: medicines.length,
    addMedicine,
    removeMedicine,
    clearBasket,
    inputError,
    canCheck,
  };
}
