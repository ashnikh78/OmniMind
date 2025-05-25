import React, { useState } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Radio,
  RadioGroup,
  FormControlLabel,
  Button,
  Alert,
  Paper,
  Stack,
} from '@mui/material';

const LearningStyleAnalyzer: React.FC = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [showResults, setShowResults] = useState(false);

  const questions = [
    {
      id: 'q1',
      question: 'When studying new material, I prefer to:',
      options: [
        'Read and take detailed notes',
        'Listen to explanations and discuss',
        'Watch demonstrations and visual aids',
        'Practice hands-on activities'
      ]
    },
    {
      id: 'q2',
      question: 'I learn best when I can:',
      options: [
        'Work independently and quietly',
        'Discuss ideas with others',
        'See visual representations',
        'Engage in physical activities'
      ]
    },
    {
      id: 'q3',
      question: 'When solving problems, I typically:',
      options: [
        'Analyze step by step',
        'Talk through the process',
        'Visualize the solution',
        'Try different approaches'
      ]
    }
  ];

  const learningStyles = {
    visual: 'Visual Learner',
    auditory: 'Auditory Learner',
    reading: 'Reading/Writing Learner',
    kinesthetic: 'Kinesthetic Learner'
  };

  const calculateLearningStyle = () => {
    const styleCounts = {
      visual: 0,
      auditory: 0,
      reading: 0,
      kinesthetic: 0
    };

    Object.values(answers).forEach(answer => {
      switch (answer) {
        case questions[0].options[0]:
        case questions[1].options[0]:
          styleCounts.reading++;
          break;
        case questions[0].options[1]:
        case questions[1].options[1]:
          styleCounts.auditory++;
          break;
        case questions[0].options[2]:
        case questions[1].options[2]:
          styleCounts.visual++;
          break;
        case questions[0].options[3]:
        case questions[1].options[3]:
          styleCounts.kinesthetic++;
          break;
      }
    });

    return Object.entries(styleCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  };

  const handleAnswer = (answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questions[currentQuestion].id]: answer
    }));

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  const getLearningStyleRecommendations = (style: string) => {
    const recommendations = {
      visual: [
        'Use mind maps and diagrams',
        'Watch educational videos',
        'Create visual flashcards',
        'Use color coding in notes'
      ],
      auditory: [
        'Participate in group discussions',
        'Record and listen to lectures',
        'Explain concepts to others',
        'Use verbal mnemonics'
      ],
      reading: [
        'Take detailed notes',
        'Read and summarize texts',
        'Create written outlines',
        'Use written flashcards'
      ],
      kinesthetic: [
        'Engage in hands-on activities',
        'Use physical objects to learn',
        'Take frequent study breaks',
        'Practice through role-playing'
      ]
    };
    return recommendations[style as keyof typeof recommendations];
  };

  if (showResults) {
    const dominantStyle = calculateLearningStyle();
    const recommendations = getLearningStyleRecommendations(dominantStyle);

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Your Learning Style Analysis
        </Typography>
        <Alert severity="success" sx={{ mb: 2 }}>
          Your dominant learning style is: {learningStyles[dominantStyle as keyof typeof learningStyles]}
        </Alert>
        <Typography variant="subtitle1" gutterBottom>
          Recommended Learning Strategies:
        </Typography>
        <Stack spacing={1}>
          {recommendations.map((rec, index) => (
            <Paper key={index} sx={{ p: 1 }}>
              <Typography>• {rec}</Typography>
            </Paper>
          ))}
        </Stack>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            setCurrentQuestion(0);
            setAnswers({});
            setShowResults(false);
          }}
          sx={{ mt: 2 }}
        >
          Retake Assessment
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <LinearProgress
        variant="determinate"
        value={(currentQuestion / questions.length) * 100}
        sx={{ mb: 2 }}
      />
      <Typography variant="h6" gutterBottom>
        Question {currentQuestion + 1} of {questions.length}
      </Typography>
      <Typography variant="body1" gutterBottom>
        {questions[currentQuestion].question}
      </Typography>
      <RadioGroup>
        {questions[currentQuestion].options.map((option, index) => (
          <FormControlLabel
            key={index}
            value={option}
            control={<Radio />}
            label={option}
            onClick={() => handleAnswer(option)}
          />
        ))}
      </RadioGroup>
    </Box>
  );
};

export default LearningStyleAnalyzer; 