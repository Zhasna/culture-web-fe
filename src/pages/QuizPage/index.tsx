import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Image,
  Modal,
  Progress,
  Radio,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  BookOutlined,
  FireOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  LockOutlined,
  ReadOutlined,
  RightOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useColourToken, useStyleToken } from 'themeStyles';
import useIsMobile from 'utils/isMobile';
import BACKEND_URI from 'configs/env.config';
import {
  AdaptivePublicQuestion,
  AdaptiveQuizProgress,
  answerAdaptiveQuizQuestion,
  generateAdaptiveQuizSession,
  resumeAdaptiveQuizSession,
  seedUserProficiency,
} from 'utils/invokeBackend';
import { useAuth } from 'contexts/AuthContext';
import { QuizCategory, QuizItem } from './quizTypes';
import quizCharacter from './characterData';
import quizExpression from './expressionData';
import quizOrnament from './ornamentData';
import './index.css';

const { Text, Title } = Typography;

const ORNAMENT = 'Ornament';

type QuizMode = {
  id: 'basics' | 'ornaments' | 'learning' | 'adaptive';
  title: string;
  description: string;
  tag: string;
  icon: React.ReactNode;
  variant: 'pink' | 'rose' | 'green' | 'blue';
  onStart: () => void;
  disabled?: boolean;
  loading?: boolean;
};

type QuizTip = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

const formatConceptName = (conceptId: string | null): string => {
  if (!conceptId) return 'Formative Practice';
  return conceptId
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const generateQuizFromDataset = (dataset: QuizCategory[]): QuizItem[] => {
  const quizItems = dataset.map((category) => {
    const randomIndex = Math.floor(Math.random() * category.items.length);
    return category.items[randomIndex];
  });

  // In-place shuffle using Fisher-Yates algorithm
  for (let i = quizItems.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = quizItems[i];
    quizItems[i] = quizItems[j];
    quizItems[j] = temp;
  }

  // Ensure every item in the generated quiz session has a unique sequential ID
  return quizItems.map((item, index) => ({
    ...item,
    id: index + 1,
  }));
};

const toAdaptiveQuizItem = (question: AdaptivePublicQuestion): QuizItem => ({
  id: 0,
  backendQuestionId: question.backendQuestionId,
  question: question.question,
  options: question.options,
  correctAnswer: '',
  image: '',
});

const QuizPage: React.FC = () => {
  const navigate = useNavigate();
  const colourToken = useColourToken();
  const styleToken = useStyleToken();
  const isMobile = useIsMobile(); // Hook to detect mobile
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<{
    [key: number]: string;
  }>({});
  const [checked, setChecked] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [loadingAdaptiveQuiz, setLoadingAdaptiveQuiz] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState<boolean>(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [activeQuizSessionId, setActiveQuizSessionId] = useState<string | null>(
    null,
  );
  const [activeQuizSource, setActiveQuizSource] = useState<
    'adaptive' | 'static' | 'learning' | null
  >(null);
  const [adaptiveProgress, setAdaptiveProgress] =
    useState<AdaptiveQuizProgress | null>(null);
  const [pendingAdaptiveQuestion, setPendingAdaptiveQuestion] =
    useState<AdaptivePublicQuestion | null>(null);
  const [adaptiveNextError, setAdaptiveNextError] = useState<string | null>(
    null,
  );
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(
    null,
  );
  const [activeTipIndex, setActiveTipIndex] = useState(0);
  const { isAuthenticated } = useAuth();
  const hasActiveQuiz = quizItems.length > 0;

  const rotatingTips: QuizTip[] = [
    {
      title: 'Knowledge Tip',
      description:
        'Adaptive sessions use each answer to select the next question. Response time is recorded for evaluation but does not change the question policy yet.',
      icon: <InfoCircleOutlined />,
    },
    {
      title: 'Knowledge Tip',
      description:
        'Go to the Learn tab and start a learning session with the AI Assistant to generate smarter quiz questions.',
      icon: <ReadOutlined />,
    },
  ];

  useEffect(() => {
    if (hasActiveQuiz) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveTipIndex((prev) => (prev + 1) % rotatingTips.length);
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [hasActiveQuiz, rotatingTips.length]);

  const generateAdaptiveQuiz = async () => {
    try {
      setLoadingAdaptiveQuiz(true);

      const result = await generateAdaptiveQuizSession();

      if (result.question) {
        setActiveQuizSessionId(result.quizId);
        setActiveQuizSource('adaptive');
        setQuizItems([toAdaptiveQuizItem(result.question)]);
        setAdaptiveProgress(result.progress);
        setPendingAdaptiveQuestion(null);
        setAdaptiveNextError(null);
        setQuestionStartedAt(Date.now());
        setSelectedAnswers({});
        setChecked(false);
        setScore(0);
        message.success(
          'Started an adaptive mastery session from your current knowledge profile.',
        );
      } else {
        setActiveQuizSessionId(null);
        setActiveQuizSource(null);
        message.info('No knowledge gaps found!');
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Adaptive quiz error:', error);
      const isMissingProficiency =
        err.message?.includes('No proficiency data found') ||
        err.message?.includes('404');

      if (isMissingProficiency) {
        Modal.confirm({
          title: 'Initialize Knowledge Profile',
          content:
            'You do not have a tracked knowledge profile yet. Would you like to initialize your baseline profile to start the adaptive quiz now, or go to the Learn tab to chat with the AI tutor first?',
          okText: 'Initialize & Start Quiz',
          cancelText: 'Go to Learn',
          onOk: async () => {
            try {
              setLoadingAdaptiveQuiz(true);
              await seedUserProficiency();
              message.success('Knowledge profile initialized!');
              await generateAdaptiveQuiz();
            } catch (seedErr) {
              const seedError = seedErr as Error;
              message.error(
                seedError.message || 'Failed to initialize knowledge profile.',
              );
            } finally {
              setLoadingAdaptiveQuiz(false);
            }
          },
          onCancel: () => {
            navigate('/learn');
          },
        });
        return;
      }

      message.error(err.message || 'Failed to generate adaptive quiz');
    } finally {
      setLoadingAdaptiveQuiz(false);
    }
  };

  const generateQuiz = (
    type: 'Expression' | 'Character' | 'Ornament' | 'Core',
  ) => {
    let dataset: QuizCategory[] = [];
    if (type === 'Character') {
      dataset = quizCharacter;
    } else if (type === 'Expression') {
      dataset = quizExpression;
    } else if (type === 'Ornament') {
      dataset = quizOrnament;
    } else if (type === 'Core') {
      // Combine both Character and Expression datasets
      dataset = [...quizCharacter, ...quizExpression];
    }

    const generatedQuiz = generateQuizFromDataset(dataset);
    const limitedQuiz =
      type === 'Ornament' ? generatedQuiz.slice(0, 6) : generatedQuiz;
    setQuizItems(limitedQuiz);
    setSelectedAnswers({});
    setChecked(false);
    setScore(0);
    setActiveQuizSessionId(null);
    setActiveQuizSource('static');
    setAdaptiveProgress(null);
    setPendingAdaptiveQuestion(null);
    setAdaptiveNextError(null);
    setQuestionStartedAt(null);
  };

  // Generate quiz from chat learning history
  const generateQuizFromLearning = async () => {
    try {
      setLoadingQuiz(true);

      // Get chat history from sessionStorage (cleared when tab closes)
      const chatHistory = sessionStorage.getItem('chatHistory');
      if (!chatHistory) {
        message.error(
          'No chat history found. Please chat with the AI first in the Learn tab.',
        );
        return;
      }

      const parsedHistory = JSON.parse(chatHistory);
      if (!Array.isArray(parsedHistory) || parsedHistory.length === 0) {
        message.error(
          'Chat history is empty. Ask questions in the chat first.',
        );
        return;
      }

      // Send to backend to generate quiz
      const response = await fetch(
        `${BACKEND_URI}/kathakali/generate-quiz-from-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatHistory: parsedHistory,
            count: 5, // Generate 5 questions
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate quiz');
      }

      const data = await response.json();

      if (!data.questions || data.questions.length === 0) {
        message.error(
          'No quiz questions could be generated from your chat history.',
        );
        return;
      }

      // Transform LLM response to QuizItem format
      const transformedQuiz: QuizItem[] = data.questions.map(
        (
          q: {
            id: number;
            question: string;
            options: string[];
            correctAnswer: string;
            explanation: string;
          },
          index: number,
        ) => ({
          id: index + 1,
          question: q.question,
          image: '', // No image for LLM-generated quiz
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        }),
      );

      setQuizItems(transformedQuiz);
      setSelectedAnswers({});
      setChecked(false);
      setScore(0);
      setActiveQuizSessionId(null);
      setActiveQuizSource('learning');
      setAdaptiveProgress(null);
      setPendingAdaptiveQuestion(null);
      setAdaptiveNextError(null);
      setQuestionStartedAt(null);

      message.success(
        `Generated ${transformedQuiz.length} questions from your learning history!`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error generating quiz from learning:', error);
      message.error(err.message || 'Failed to generate quiz from chat history');
    } finally {
      setLoadingQuiz(false);
    }
  };

  // Handle option change for each quiz item.
  const onOptionChange = (quizId: number, value: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [quizId]: value }));
  };

  // Check the answers, update the cumulative score, and display a success message.
  const checkAnswers = async () => {
    if (activeQuizSource === 'adaptive' && activeQuizSessionId) {
      const item = quizItems[0];
      const selectedAnswer = item ? selectedAnswers[item.id] : undefined;
      if (!item?.backendQuestionId || !selectedAnswer) {
        message.error('Select an answer before submitting.');
        return;
      }

      try {
        setSubmittingQuiz(true);
        const submission = await answerAdaptiveQuizQuestion({
          quizId: activeQuizSessionId,
          questionId: item.backendQuestionId,
          answer: selectedAnswer,
          responseMs: questionStartedAt
            ? Date.now() - questionStartedAt
            : undefined,
        });

        setQuizItems((current) =>
          current.map((question) => ({
            ...question,
            correctAnswer: submission.result.correctAnswer,
            explanation: submission.result.explanation,
          })),
        );
        setChecked(true);
        setScore(submission.progress.correct);
        setAdaptiveProgress(submission.progress);
        setPendingAdaptiveQuestion(submission.nextQuestion);
        setAdaptiveNextError(submission.nextQuestionError || null);

        if (submission.result.correct) {
          message.success(
            'Correct — this response now informs the next question.',
          );
        } else {
          message.info('The next question will reinforce the same concept.');
        }

        if (submission.proficiencyUpdatesApplied.length > 0) {
          message.success(
            'The session mastery criterion was met for a concept.',
          );
        }
      } catch (error: unknown) {
        const err = error as Error;
        console.error('Adaptive quiz submission failed:', error);
        message.error(err.message || 'Failed to submit adaptive answer');
      } finally {
        setSubmittingQuiz(false);
      }
      return;
    }

    // Always grade on the frontend using the quiz payload (robust matching).
    let correctCount = 0;
    quizItems.forEach((item) => {
      if (selectedAnswers[item.id] === item.correctAnswer) {
        correctCount += 1;
      }
    });
    setScore((prev) => prev + correctCount);
    setChecked(true);
    message.success(
      `You got ${correctCount} out of ${quizItems.length} correct!`,
    );
  };

  const showNextAdaptiveQuestion = async () => {
    if (!activeQuizSessionId || adaptiveProgress?.completed) return;

    try {
      setSubmittingQuiz(true);
      let nextQuestion = pendingAdaptiveQuestion;
      let nextProgress = adaptiveProgress;

      if (!nextQuestion) {
        const resumed = await resumeAdaptiveQuizSession({
          quizId: activeQuizSessionId,
        });
        nextQuestion = resumed.question;
        nextProgress = resumed.progress;
      }

      if (!nextQuestion) {
        message.error('No next question is available. Please retry.');
        return;
      }

      setQuizItems([toAdaptiveQuizItem(nextQuestion)]);
      setSelectedAnswers({});
      setChecked(false);
      setAdaptiveProgress(nextProgress);
      setPendingAdaptiveQuestion(null);
      setAdaptiveNextError(null);
      setQuestionStartedAt(Date.now());
    } catch (error: unknown) {
      const err = error as Error;
      message.error(err.message || 'Failed to load the next question');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const backToQuizModes = () => {
    setQuizItems([]);
    setSelectedAnswers({});
    setChecked(false);
    setScore(0);
    setActiveQuizSessionId(null);
    setActiveQuizSource(null);
    setAdaptiveProgress(null);
    setPendingAdaptiveQuestion(null);
    setAdaptiveNextError(null);
    setQuestionStartedAt(null);
  };

  const handleBackToQuizModes = () => {
    if (
      activeQuizSource === 'adaptive' &&
      !adaptiveProgress?.completed &&
      quizItems.length > 0
    ) {
      Modal.confirm({
        title: 'Leave Adaptive Quiz Session?',
        content:
          'Your answered questions and proficiency updates are already saved. Are you sure you want to return to quiz modes?',
        okText: 'Exit to Modes',
        cancelText: 'Stay in Quiz',
        onOk: () => {
          backToQuizModes();
        },
      });
      return;
    }
    backToQuizModes();
  };

  const quizModes: QuizMode[] = [
    {
      id: 'basics',
      title: 'Kathakali Basics',
      description:
        'Master the history, 101 mudras, and the foundational stories of the art form.',
      tag: 'Static',
      icon: <BookOutlined />,
      variant: 'pink',
      onStart: () => generateQuiz('Core'),
    },
    {
      id: 'ornaments',
      title: 'Ornaments & Attire',
      description:
        'Identify the elaborate Kireetam (headgear) and Vesham types of different characters.',
      tag: 'Visual',
      icon: <TrophyOutlined />,
      variant: 'rose',
      onStart: () => generateQuiz(ORNAMENT),
    },
    {
      id: 'learning',
      title: 'Generate from Learning',
      description:
        "A customized challenge based on the learning session you've recently completed.",
      tag: 'AI Powered',
      icon: <ReadOutlined />,
      variant: 'green',
      onStart: generateQuizFromLearning,
      loading: loadingQuiz,
    },
    {
      id: 'adaptive',
      title: 'Adaptive Quiz',
      description:
        'A sequential mastery session where each answer informs the next concept and question.',
      tag: 'AI Powered',
      icon: <ThunderboltOutlined />,
      variant: 'blue',
      onStart: async () => {
        if (!isAuthenticated) {
          message.warning(
            'Please sign in to access the personalized Adaptive Quiz.',
          );
          return;
        }
        await generateAdaptiveQuiz();
      },
      disabled: false,
      loading: loadingAdaptiveQuiz,
    },
  ];

  return (
    <div className="quiz-page-container">
      {!hasActiveQuiz && (
        <>
          <div className="quiz-page-header">
            <div className="quiz-badge">
              <span className="quiz-badge-icon">
                <BookOutlined />
              </span>
              <span>Learning Arena</span>
            </div>
            <Title
              className="quiz-main-title"
              style={{
                ...styleToken.pageHeadingTextStyle,
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Choose Your <span className="quiz-highlight-title">Quest</span>
            </Title>
            <Text
              className="quiz-main-subtitle"
              style={{ color: colourToken.gray }}
            >
              From static foundational modules to AI-driven adaptive challenges,
              sharpen your mastery of India&apos;s most vibrant storytelling
              art.
            </Text>
          </div>

          <div className="quiz-actions-grid">
            {quizModes.map((mode) => (
              <Card
                key={mode.id}
                className={`quiz-quest-card quiz-quest-${mode.variant} ${mode.disabled ? 'quiz-quest-disabled' : ''}`}
                onClick={() => {
                  if (!mode.disabled) {
                    mode.onStart();
                  }
                }}
              >
                <div className="quiz-quest-tag">
                  {!isAuthenticated && mode.id === 'adaptive' ? (
                    <>
                      <LockOutlined style={{ marginRight: 4 }} />
                      Sign In Required
                    </>
                  ) : (
                    mode.tag
                  )}
                </div>
                <div
                  className={`quiz-quest-icon quiz-quest-icon-${mode.variant}`}
                >
                  {mode.icon}
                </div>
                <h3 className="quiz-quest-title">{mode.title}</h3>
                <p className="quiz-quest-description">{mode.description}</p>
                <div className="quiz-quest-footer">
                  <span className="quiz-quest-action-text">
                    {!isAuthenticated && mode.id === 'adaptive'
                      ? 'Sign In to Play'
                      : 'Start Quiz'}
                  </span>
                  <div className="quiz-quest-action-icon">
                    {mode.loading ? (
                      <span className="quiz-inline-loader" />
                    ) : (
                      <RightOutlined />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="quiz-tip-card">
            <div className="quiz-tip-row" key={activeTipIndex}>
              <div className="quiz-tip-left quiz-tip-content">
                <div className="quiz-tip-icon">
                  {rotatingTips[activeTipIndex].icon}
                </div>
                <div>
                  <div className="quiz-tip-title">
                    {rotatingTips[activeTipIndex].title}
                  </div>
                  <Text style={{ color: colourToken.gray }}>
                    {rotatingTips[activeTipIndex].description}
                  </Text>
                  <div
                    className="quiz-tip-indicators"
                    aria-label="Tip indicators"
                  >
                    {rotatingTips.map((tip, index) => (
                      <button
                        type="button"
                        key={tip.description}
                        className={`quiz-tip-dot ${index === activeTipIndex ? 'quiz-tip-dot-active' : ''}`}
                        aria-label={`Show ${tip.title}`}
                        onClick={() => setActiveTipIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {hasActiveQuiz && (
        <div className="quiz-back-wrap">
          <Button
            type="default"
            className="quiz-back-button"
            icon={<LeftOutlined />}
            onClick={handleBackToQuizModes}
          >
            Back to Quiz Modes
          </Button>
        </div>
      )}

      {hasActiveQuiz && activeQuizSource === 'adaptive' && adaptiveProgress && (
        <Card className="quiz-tip-card quiz-adaptive-progress-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                  flexWrap: 'wrap',
                }}
              >
                <Tag
                  color="blue"
                  style={{ fontSize: '0.85rem', padding: '2px 8px' }}
                >
                  <ThunderboltOutlined /> Active Concept:{' '}
                  {formatConceptName(adaptiveProgress.activeConcept)}
                </Tag>
                {adaptiveProgress.currentStreak > 0 && (
                  <Tag
                    color="gold"
                    style={{ fontSize: '0.85rem', padding: '2px 8px' }}
                  >
                    <FireOutlined /> {adaptiveProgress.currentStreak} in a row
                  </Tag>
                )}
              </div>
              <Text strong style={{ fontSize: '0.95rem' }}>
                Question{' '}
                {adaptiveProgress.answered +
                  (adaptiveProgress.completed ? 0 : 1)}{' '}
                of {adaptiveProgress.maxQuestions}
                {' · '}Score: {score}/{adaptiveProgress.answered}
                {' · '}Concepts Mastered: {adaptiveProgress.masteredConcepts}/
                {adaptiveProgress.totalConcepts}
              </Text>
            </div>
            {!adaptiveProgress.completed && (
              <div style={{ minWidth: 200, textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: colourToken.gray,
                    marginBottom: 4,
                  }}
                >
                  Mastery Streak ({adaptiveProgress.currentStreak}/
                  {adaptiveProgress.masteryStreak})
                </div>
                <Progress
                  percent={Math.min(
                    100,
                    Math.round(
                      (adaptiveProgress.currentStreak /
                        adaptiveProgress.masteryStreak) *
                        100,
                    ),
                  )}
                  size="small"
                  status={
                    adaptiveProgress.currentStreak >=
                    adaptiveProgress.masteryStreak
                      ? 'success'
                      : 'active'
                  }
                  strokeColor={colourToken.themePrimary}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="quiz-cards-wrap">
        {quizItems.map((item) => (
          <Card
            key={item.id}
            className="quiz-question-card"
            style={{ backgroundColor: colourToken.lightGray }}
          >
            <p className="quiz-question-text">{item.question}</p>
            <div
              className={`quiz-question-layout ${isMobile ? 'quiz-question-layout-mobile' : ''}`}
            >
              {/* Only show image if it exists */}
              {item.image && (
                <Image
                  src={item.image}
                  className={`quiz-question-image ${isMobile ? 'quiz-question-image-mobile' : ''}`}
                />
              )}
              <div className="quiz-question-options-wrap">
                <Radio.Group
                  onChange={(e) => onOptionChange(item.id, e.target.value)}
                  value={selectedAnswers[item.id]}
                  disabled={checked}
                  className="quiz-radio-group"
                >
                  {item.options.map((option) => (
                    <Radio
                      key={option}
                      value={option}
                      className="quiz-radio-item"
                    >
                      {option}
                    </Radio>
                  ))}
                </Radio.Group>

                {checked && (
                  <div className="quiz-answer-feedback">
                    {selectedAnswers[item.id] === item.correctAnswer ? (
                      <Text style={{ color: 'green', fontWeight: 'bold' }}>
                        ✓ Correct!
                      </Text>
                    ) : (
                      <div>
                        <Text
                          style={{
                            color: 'red',
                            fontWeight: 'bold',
                            display: 'block',
                          }}
                        >
                          ✗ Incorrect. Correct Answer: {item.correctAnswer}
                        </Text>
                      </div>
                    )}
                    {/* Show explanation if available (from LLM-generated quiz) */}
                    {item.explanation && (
                      <div className="quiz-answer-explanation">
                        <Text
                          style={{
                            color: colourToken.gray,
                            fontSize: '0.9rem',
                          }}
                        >
                          <strong>Explanation:</strong> {item.explanation}
                        </Text>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Check Answers button (only shows if quiz items exist and not yet checked) */}
      {quizItems.length > 0 && !checked && (
        <div className="quiz-submit-wrap">
          <Button
            type="primary"
            onClick={checkAnswers}
            disabled={Object.keys(selectedAnswers).length < quizItems.length}
            loading={submittingQuiz}
            size="large"
          >
            {activeQuizSource === 'adaptive'
              ? 'Submit Answer'
              : 'Check Answers'}
          </Button>
        </div>
      )}

      {quizItems.length > 0 &&
        checked &&
        activeQuizSource === 'adaptive' &&
        !adaptiveProgress?.completed && (
          <div className="quiz-submit-wrap">
            <Button
              type="primary"
              onClick={showNextAdaptiveQuestion}
              loading={submittingQuiz}
              size="large"
            >
              {pendingAdaptiveQuestion
                ? 'Next Question'
                : 'Retry Next Question'}
            </Button>
            {adaptiveNextError && (
              <Text
                style={{
                  color: colourToken.gray,
                  display: 'block',
                  marginTop: 8,
                }}
              >
                {adaptiveNextError}
              </Text>
            )}
          </div>
        )}

      {quizItems.length > 0 &&
        activeQuizSource === 'adaptive' &&
        adaptiveProgress?.completed && (
          <Card
            className="quiz-tip-card"
            style={{
              marginTop: 24,
              textAlign: 'center',
              padding: '24px 16px',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>
              <TrophyOutlined style={{ color: '#faad14' }} />
            </div>
            <Title level={3} style={{ marginBottom: 8 }}>
              Adaptive Session Complete!
            </Title>
            <p
              style={{
                color: colourToken.gray,
                fontSize: '1rem',
                maxWidth: 520,
                margin: '0 auto 16px',
              }}
            >
              {adaptiveProgress.completionReason === 'mastery_criterion_met'
                ? 'Excellent work! You achieved the mastery evidence streak for your focus concepts.'
                : 'You have reached the maximum question limit for this session. Your progress has been updated.'}
            </p>
            <div style={{ marginBottom: 20 }}>
              <Tag
                color="green"
                style={{ fontSize: '0.9rem', padding: '4px 12px' }}
              >
                Final Score: {score} / {adaptiveProgress.answered}
              </Tag>
              <Tag
                color="blue"
                style={{ fontSize: '0.9rem', padding: '4px 12px' }}
              >
                Concepts Mastered: {adaptiveProgress.masteredConcepts} /{' '}
                {adaptiveProgress.totalConcepts}
              </Tag>
            </div>
            <div>
              <Button type="primary" size="large" onClick={backToQuizModes}>
                Return to Quiz Modes
              </Button>
            </div>
          </Card>
        )}

      {/* Score display */}
      {quizItems.length > 0 && (
        <div className="quiz-score-wrap">
          <h3>
            {activeQuizSource === 'adaptive' && adaptiveProgress
              ? `Session Score: ${score}/${adaptiveProgress.answered}`
              : `Total Score: ${score}`}
          </h3>
        </div>
      )}
    </div>
  );
};

export default QuizPage;
