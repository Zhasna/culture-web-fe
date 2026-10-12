import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, message, Typography, Flex, Spin } from 'antd';
import { useAuth } from 'contexts/AuthContext';
import Button from 'components/Common/Button';
import { supabase } from 'configs/supabase.config';
import { useStyleToken } from 'themeStyles';

const { Title, Text } = Typography;

const ResetPasswordPage: React.FC = () => {
  const { updateOwnPassword, isLoading } = useAuth();
  const navigate = useNavigate();
  const styleToken = useStyleToken();

  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (hash.get('error')) {
      setChecked(true);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
        setChecked(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
        setChecked(true);
      }
    });

    const timeout = setTimeout(() => setChecked(true), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (values: { password: string; confirmPassword: string }) => {
    try {
      await updateOwnPassword(values.password);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to reset password');
      return;
    }

    try {
      await supabase.auth.signOut();
    } catch {
    }
    message.success('Password updated successfully. Please sign in again.');
    navigate('/sign-in');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px',
    border: 'none',
    borderBottom: '2px solid #333',
    background: 'transparent',
    color: 'white',
    fontSize: '1.2rem',
    outline: 'none',
    transition: 'border-color 0.3s',
    backgroundColor: '#2b2d38',
  };

  if (!checked) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '70vh' }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (!ready) {
    return (
      <Flex vertical align="center" style={{ minHeight: '70vh', padding: '2rem 0' }}>
        <Text style={styleToken.subtitleTextStyle}>
          This reset link is invalid or has expired.
        </Text>
        <Text style={{ ...styleToken.subtitleTextStyle, marginTop: '1rem' }}>
          <Link to="/sign-in" style={{ color: styleToken.colorPrimary }}>
            Back to Sign In to request a new link
          </Link>
        </Text>
      </Flex>
    );
  }

  return (
    <Flex vertical align="center" style={{ minHeight: '70vh', padding: '2rem 0' }}>
      <Title style={styleToken.pageHeadingTextStyle}>Reset Password</Title>
      <Text style={styleToken.subtitleTextStyle}>
        Enter your new password for this account.
      </Text>

      <Form
        onFinish={handleSubmit}
        layout="vertical"
        style={{ maxWidth: '420px', width: '100%', marginTop: '2rem' }}
      >
        <Form.Item
          name="password"
          rules={[
            { required: true, message: 'Please enter your new password' },
            { min: 6, message: 'Password must be at least 6 characters' },
          ]}
        >
          <input type="password" placeholder="New Password" style={inputStyle} />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Please confirm your new password' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('Passwords do not match'));
              },
            }),
          ]}
        >
          <input type="password" placeholder="Confirm New Password" style={inputStyle} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isLoading} width="100%">
            Update Password
          </Button>
        </Form.Item>
      </Form>

      <Text style={{ ...styleToken.subtitleTextStyle, marginTop: '1rem' }}>
        Back to{' '}
        <Link to="/sign-in" style={{ color: styleToken.colorPrimary }}>
          Sign In
        </Link>
      </Text>
    </Flex>
  );
};

export default ResetPasswordPage;