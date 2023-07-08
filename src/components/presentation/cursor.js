import React from 'react';
import { useCurrentIndex } from 'components/utils/hooks';
import storage from 'utils/data/storage';
import './index.scss';

const getCursor = (index, thisCursor, viewBox) => {
  const inactive = {
    x: -1,
    y: -1,
  }

  if (index === -1) return inactive;

  const currentData = thisCursor[index];
  if (currentData.x === -1 && currentData.y === -1) return inactive;

  return {
    x: viewBox.x + (currentData.x * viewBox.width),
    y: viewBox.y + (currentData.y * viewBox.height),
  };
};

const Cursor = ({ viewBox, userId }) => {
  const thisCursor = userId ? storage.cursors[userId] : storage.cursor;
  const currentIndex = useCurrentIndex(thisCursor);
  const { x, y } = getCursor(currentIndex, thisCursor, viewBox);

  const currentPresentersIndex = useCurrentIndex(storage.presenters);
  let presenterId = userId;
  if (storage.presenters) {
    const presenter =  storage.presenters[currentPresentersIndex];
    presenterId = presenter ? presenter.userId : "none";
  }

  if (x === -1 || y === -1) return null;

  if (userId == presenterId) {
    return (
      <circle
        className="cursor"
        style={{ cx: x, cy: y }}
      />
    );
  } else {
    return (
      <g>
      <circle
        className="cursor-nonpresenters"
        style={{ cx: x, cy: y }}
      />
      { storage.participants ?
        <text
         className="cursor-label"
          x={x}
          y={y}
          dx="0.6rem"
          dy="0.3rem"
        >
          { storage.participants[userId].name }
        </text>
        : null
      }
      </g>
    );
  }
};

export default Cursor;
