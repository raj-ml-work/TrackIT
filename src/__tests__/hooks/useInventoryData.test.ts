import { renderHook, waitFor } from '@testing-library/react';
import { useInventoryData } from '../../hooks/useInventoryData';
import * as dataLoader from '../../services/dataLoader';

jest.mock('../../services/dataLoader');

describe('useInventoryData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load initial inventory data', async () => {
    const mockData = {
      data: [{ id: '1', name: 'Test Asset' }],
      total: 1,
      page: 1,
      totalPages: 1
    };

    (dataLoader.dataLoader.loadAllAssets as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => useInventoryData());

    await waitFor(() => {
      expect(result.current.assets).toHaveLength(1);
      expect(result.current.total).toBe(1);
    });
  });

  it('should handle filter changes', async () => {
    const { result } = renderHook(() => useInventoryData());

    act(() => {
      result.current.setFilters({ status: 'Available' });
    });

    await waitFor(() => {
      expect(dataLoader.dataLoader.loadAllAssets).toHaveBeenCalledWith(1);
    });
  });
});