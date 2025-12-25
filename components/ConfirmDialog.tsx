import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Check, AlertCircle } from 'lucide-react';

export enum DialogType {
  CONFIRM = 'confirm',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = DialogType.CONFIRM,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}) => {
  const getDialogConfig = () => {
    switch (type) {
      case DialogType.ERROR:
        return {
          icon: <AlertCircle size={24} className="text-red-500" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-700',
          buttonColor: 'bg-red-500 hover:bg-red-600'
        };
      case DialogType.WARNING:
        return {
          icon: <AlertTriangle size={24} className="text-yellow-500" />,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-700',
          buttonColor: 'bg-yellow-500 hover:bg-yellow-600'
        };
      case DialogType.INFO:
        return {
          icon: <AlertCircle size={24} className="text-blue-500" />,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-700',
          buttonColor: 'bg-blue-500 hover:bg-blue-600'
        };
      default: // CONFIRM
        return {
          icon: <AlertTriangle size={24} className="text-gray-700" />,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-700',
          buttonColor: 'bg-gray-900 hover:bg-gray-800'
        };
    }
  };

  const config = getDialogConfig();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className={`bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative border ${config.borderColor}`}
          >
            <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" onClick={onClose}>
              <X size={18} />
            </button>

            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gray-100">
                {config.icon}
              </div>
              <div>
                <h4 className={`text-lg font-bold ${config.textColor}`}>{title}</h4>
                <p className={`text-sm ${config.textColor} mt-1`}>{message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {type === DialogType.CONFIRM && (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {cancelText}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onConfirm?.();
                      onClose();
                    }}
                    className={`${config.buttonColor} px-4 py-2 rounded-lg text-white font-semibold hover:-translate-y-0.5 transition-transform`}
                  >
                    {confirmText}
                  </button>
                </>
              )}
              {type !== DialogType.CONFIRM && (
                <button
                  type="button"
                  onClick={onClose}
                  className={`${config.buttonColor} px-4 py-2 rounded-lg text-white font-semibold hover:-translate-y-0.5 transition-transform`}
                >
                  OK
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;