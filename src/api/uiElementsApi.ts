import { UIElementConfig } from '../types';

/**
 * Client API for UI Elements management with database persistence
 */

export async function fetchUIElementsApi(tenantId?: string): Promise<UIElementConfig[] | null> {
  try {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    params.set('_t', Date.now().toString());

    const res = await fetch(`/api/ui-elements?${params.toString()}`, {
      cache: 'no-store',
      headers: {
        'x-tenant-id': tenantId || '',
        'Cache-Control': 'no-cache',
      },
    });

    if (!res.ok) {
      console.warn('[UIElementsApi] Failed to fetch UI elements, status:', res.status);
      return null;
    }

    const data = await res.json();
    if (data && Array.isArray(data.elements)) {
      return data.elements;
    }
    return null;
  } catch (err) {
    console.warn('[UIElementsApi] Error fetching UI elements:', err);
    return null;
  }
}

export async function saveUIElementsListApi(
  elements: UIElementConfig[],
  tenantId?: string,
  performedBy?: string
): Promise<{ success: boolean; elements?: UIElementConfig[] }> {
  try {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);

    const res = await fetch(`/api/ui-elements?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId || '',
      },
      body: JSON.stringify({
        elements,
        performedBy: performedBy || 'الأدمن الرئيسي',
      }),
    });

    if (!res.ok) {
      console.error('[UIElementsApi] Failed to save elements list, status:', res.status);
      return { success: false };
    }

    const data = await res.json();
    return {
      success: !!data.success,
      elements: Array.isArray(data.elements) ? data.elements : elements,
    };
  } catch (err) {
    console.error('[UIElementsApi] Network error saving elements list:', err);
    return { success: false };
  }
}

export async function createUIElementApi(
  element: Partial<UIElementConfig>,
  tenantId?: string
): Promise<{ success: boolean; element?: UIElementConfig; elements?: UIElementConfig[]; message?: string }> {
  try {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);

    const cleanElement = {
      ...element,
      id: element.id ? element.id.split('?')[0].trim() : undefined,
    };

    const res = await fetch(`/api/ui-elements?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId || '',
      },
      body: JSON.stringify({
        element: cleanElement,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[UIElementsApi] Network error creating element:', err);
    return { success: false, message: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

export async function updateUIElementApi(
  id: string,
  element: Partial<UIElementConfig>,
  tenantId?: string
): Promise<{ success: boolean; element?: UIElementConfig; elements?: UIElementConfig[]; message?: string }> {
  try {
    const cleanId = id.split('?')[0].trim();
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);

    const cleanElement = {
      ...element,
      id: cleanId,
    };

    const res = await fetch(`/api/ui-elements/${encodeURIComponent(cleanId)}?${params.toString()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId || '',
      },
      body: JSON.stringify({
        element: cleanElement,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[UIElementsApi] Network error updating element:', err);
    return { success: false, message: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

export async function toggleUIElementApi(
  id: string,
  enabled?: boolean,
  tenantId?: string
): Promise<{ success: boolean; elements?: UIElementConfig[]; message?: string }> {
  try {
    const cleanId = id.split('?')[0].trim();
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);

    const res = await fetch(`/api/ui-elements/${encodeURIComponent(cleanId)}/toggle?${params.toString()}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId || '',
      },
      body: JSON.stringify({ enabled }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[UIElementsApi] Network error toggling element:', err);
    return { success: false, message: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

export async function toggleUIElementVisibilityApi(
  id: string,
  visibleToNonMembers?: boolean,
  tenantId?: string
): Promise<{ success: boolean; elements?: UIElementConfig[]; message?: string }> {
  try {
    const cleanId = id.split('?')[0].trim();
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);

    const res = await fetch(`/api/ui-elements/${encodeURIComponent(cleanId)}/visibility?${params.toString()}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId || '',
      },
      body: JSON.stringify({ visibleToNonMembers }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[UIElementsApi] Network error toggling visibility:', err);
    return { success: false, message: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

export async function deleteUIElementApi(
  id: string,
  tenantId?: string
): Promise<{ success: boolean; elements?: UIElementConfig[]; message?: string }> {
  try {
    const cleanId = id.split('?')[0].trim();
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);

    const res = await fetch(`/api/ui-elements/${encodeURIComponent(cleanId)}?${params.toString()}`, {
      method: 'DELETE',
      headers: {
        'x-tenant-id': tenantId || '',
      },
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[UIElementsApi] Network error deleting element:', err);
    return { success: false, message: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

export async function resetUIElementsApi(
  tenantId?: string
): Promise<{ success: boolean; elements?: UIElementConfig[]; message?: string }> {
  try {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);

    const res = await fetch(`/api/ui-elements/reset?${params.toString()}`, {
      method: 'POST',
      headers: {
        'x-tenant-id': tenantId || '',
      },
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[UIElementsApi] Network error resetting elements:', err);
    return { success: false, message: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}
