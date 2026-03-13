import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const LivePage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/sports', { replace: true });
  }, [navigate]);

  return null;
};

export default LivePage;
