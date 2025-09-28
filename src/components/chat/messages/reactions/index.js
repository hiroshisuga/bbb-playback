import React from 'react';
import cx from 'classnames';
import './index.scss';

const sortByCount = (r1, r2) => r2.number - r1.number;

const ChatMessageReactions = (props) => {
  const {
    reactions,
    active,
  } = props;

  if (reactions.length === 0) return null;
  return (
    <div
      className='reactions-wrapper'
    >
      {reactions.sort(sortByCount).map((details) => (
        <span
          className={cx('emoji-wrapper', { inactive: !active })}
        >
          <em-emoji
            size={parseFloat(
              window.getComputedStyle(document.documentElement).fontSize,
            )}
          >{details.emoji}</em-emoji>
          <span>{details.count}</span>
        </span>
      )
      )}
    </div>
  );
};

export default ChatMessageReactions;
