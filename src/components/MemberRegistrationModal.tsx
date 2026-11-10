import React from 'react';
import { MemberFormModal } from './MemberFormModal';
import { Member, Language, MemberRegistrationField, AssociationSettings } from '../types';

export interface MemberRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterSuccess: (newMember: Member, plainPassword?: string) => void;
  members: Member[];
  lang: Language;
  registrationFields: MemberRegistrationField[];
  associationName: string;
  settings?: AssociationSettings;
  onOpenLoginModal?: () => void;
}

/**
 * Unified Public Member Registration Component:
 * Directly consumes the exact same MemberFormModal and registrationFields
 * configured in Admin Panel -> Manage Registration Fields.
 * Guarantees 100% parity across fields, order, labels, validation, and multi-tenant persistence.
 */
export const MemberRegistrationModal: React.FC<MemberRegistrationModalProps> = ({
  isOpen,
  onClose,
  onRegisterSuccess,
  members,
  lang,
  registrationFields,
  associationName,
  settings,
  onOpenLoginModal,
}) => {
  return (
    <MemberFormModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={(memberData, plainPassword) => {
        const newMember: Member = {
          ...memberData,
          id: `m-${Date.now()}`,
        };
        onRegisterSuccess(newMember, plainPassword);
      }}
      existingMembersCount={members.length}
      members={members}
      lang={lang}
      registrationFields={registrationFields}
      isPublicRegistration={true}
      associationName={associationName}
      settings={settings}
      onOpenLoginModal={onOpenLoginModal}
    />
  );
};
