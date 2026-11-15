import { describe, it, expect, vi } from 'vitest';
import { downloadFile } from '@/lib/download';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('downloadFile utility', () => {
  it('triggers browser file download with blob and custom filename from disposition', async () => {
    const mockData = 'col1,col2\nval1,val2';
    const mockResponse = {
      data: mockData,
      headers: {
        'content-type': 'text/csv',
        'content-disposition': 'attachment; filename="custom_export.csv"',
      },
    };

    (apiClient.get as any).mockResolvedValueOnce(mockResponse);

    // Mock window.URL
    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/fake-uuid');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await downloadFile('/test-url/', 'fallback.csv');

    expect(apiClient.get).toHaveBeenCalledWith('/test-url/', { responseType: 'blob' });
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost/fake-uuid');
    clickSpy.mockRestore();
  });
});
