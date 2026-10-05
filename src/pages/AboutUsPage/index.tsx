import { Typography, Flex } from 'antd';
import { useStyleToken } from 'themeStyles';
import useIsMobile from 'utils/isMobile';
import kathakaliVideoUrl from './content';

const { Title, Text } = Typography;

function AboutUsPage() {
  const styleToken = useStyleToken();
  const isMobile = useIsMobile();

  const titleTextStyle = isMobile ? styleToken.titleTextStyleMobile : styleToken.titleTextStyle;
  const subtitleTextStyle = isMobile ? styleToken.subtitleTextStyleMobile : styleToken.subtitleTextStyle;

  return (
    <Flex vertical align="center">
      <Title style={styleToken.pageHeadingTextStyle}>About Us</Title>
      <Flex vertical={isMobile} gap="large">
        <Flex style={{ width: '100%', justifyContent: 'center', marginTop: '2.5rem' }}>
          <iframe
            src={kathakaliVideoUrl}
            title="Kathakali Youtube Video"
            allowFullScreen
            frameBorder={0}
            style={{
              width: '100%',
              maxWidth: isMobile ? '100%' : '800px',
              height: isMobile ? '300px' : '450px',
              border: '2px solid #ccc', // Added border property
              borderRadius: '8px', // Optional for rounded corners
            }}
          />
        </Flex>
        <Flex vertical>
          <Title style={titleTextStyle}>
            KathakalAI has many resources that teach you more about different
            cultures.
          </Title>
          <Flex vertical>
            <a href="/cultures/kathakali" style={styleToken.cultureLinkTextStylePink}>
              Kathakali
            </a>
            <Text style={subtitleTextStyle}>
              Kathakali is a classical dance-drama from Kerala, India, known for
              its vibrant costumes, intricate makeup, and elaborate facial
              expressions. It combines dance, music, and acting to tell tales
              from Indian epics like the Mahabharata and Ramayana.
            </Text>
            <a href="/cultures/kootiyattam" style={styleToken.cultureLinkTextStylePink}>
              Kootiyattam
            </a>
            <Text style={subtitleTextStyle}>
              Koodiyattam is an ancient Sanskrit theater tradition from Kerala,
              considered one of the oldest living forms of theater. It blends
              dance, drama, and ritualistic elements.
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
}

export default AboutUsPage;
