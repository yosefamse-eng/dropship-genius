import { toast } from 'sonner';

export enum ErrorType {
  AUTH = 'AUTH',
  API_LIMIT = 'API_LIMIT',
  NETWORK = 'NETWORK',
  DATA_FETCH = 'DATA_FETCH',
  PAYMENT = 'PAYMENT',
  UNKNOWN = 'UNKNOWN'
}

interface ErrorDetails {
  message: string;
  type: ErrorType;
  raw?: any;
}

export const mapErrorToFriendlyMessage = (error: any): ErrorDetails => {
  const errorMessage = error?.message || String(error);
  
  // Firebase Auth Errors
  if (errorMessage.includes('auth/unauthorized-domain')) {
    return {
      message: 'Dominio no autorizado. Por favor, abre la app en una pestaña nueva usando el botón superior derecho.',
      type: ErrorType.AUTH
    };
  }
  if (errorMessage.includes('auth/popup-closed-by-user')) {
    return {
      message: 'Inicio de sesión cancelado.',
      type: ErrorType.AUTH
    };
  }
  if (errorMessage.includes('auth/network-request-failed')) {
    return {
      message: 'Error de red. Revisa tu conexión a internet.',
      type: ErrorType.NETWORK
    };
  }

  // Gemini / API Errors
  if (errorMessage.includes('Rpc failed') || errorMessage.includes('xhr error') || errorMessage.includes('ProxyUnaryCall')) {
    return {
      message: 'Error de conexión con la IA. Por favor, intenta de nuevo en unos segundos.',
      type: ErrorType.NETWORK
    };
  }
  if (errorMessage.includes('quota exceeded') || errorMessage.includes('429')) {
    return {
      message: 'Límite de IA alcanzado. Por favor, intenta de nuevo en unos minutos o mejora a PRO.',
      type: ErrorType.API_LIMIT
    };
  }
  if (errorMessage.includes('API key not valid')) {
    return {
      message: 'Error de configuración del sistema. Contacta con soporte.',
      type: ErrorType.UNKNOWN
    };
  }

  // Firestore Errors
  if (errorMessage.includes('permission-denied')) {
    return {
      message: 'No tienes permisos para realizar esta acción.',
      type: ErrorType.AUTH
    };
  }

  // Default
  return {
    message: 'Algo salió mal. Por favor, intenta de nuevo.',
    type: ErrorType.UNKNOWN,
    raw: error
  };
};

export const showErrorToast = (error: any) => {
  const { message } = mapErrorToFriendlyMessage(error);
  toast.error(message, {
    duration: 5000,
    position: 'top-right',
  });
};

export const showSuccessToast = (message: string) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-right',
  });
};

export const showInfoToast = (message: string) => {
  toast.info(message, {
    duration: 3000,
    position: 'top-right',
  });
};
