import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ID } from 'utils/data';
import './index.scss';

const intlMessages = defineMessages({
  aria: {
    id: 'error.wrapper.aria',
    description: 'Aria label for the error wrapper',
  },
});

export default function Error(props) {
  const intl = useIntl();
  const {
    code,
  } = props;

  return (
    <div
      aria-label={intl.formatMessage(intlMessages.aria)}
      className="error-wrapper"
      id={ID.ERROR}
    >
      <div className="error-code">
        {code}
      </div>
    </div>
  );
}
